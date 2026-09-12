"""Read-only public WordPress export. No credentials or remote mutations."""
import json, re, time, urllib.request, xml.etree.ElementTree as ET
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://www.summitcustombuilders.net'
def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'SummitSiteMigration/1.0'})
    with urllib.request.urlopen(req, timeout=25) as r:
        return r.read().decode('utf-8', errors='replace')

class Node:
    def __init__(self, tag='', attrs=None):
        self.tag, self.attrs, self.children = tag, dict(attrs or []), []
    def text(self):
        return ' '.join(' '.join(c.text() if isinstance(c, Node) else c for c in self.children).split())
    def walk(self):
        yield self
        for c in self.children:
            if isinstance(c, Node): yield from c.walk()
class Tree(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.root=Node('root'); self.stack=[self.root]; self.feed(html)
    def handle_starttag(self, tag, attrs):
        n=Node(tag, attrs); self.stack[-1].children.append(n)
        if tag not in ['img','br','hr','meta','link','input','source','area','wbr','embed']:
            self.stack.append(n)
    def handle_endtag(self, tag):
        for i in range(len(self.stack)-1,0,-1):
            if self.stack[i].tag==tag: self.stack=self.stack[:i]; break
    def handle_data(self, data): self.stack[-1].children.append(data)

if __name__ == '__main__':
    xml=fetch(BASE+'/sitemap.xml')
    (ROOT/'data/legacy-sitemap.xml').write_text(xml)
    ns={'s':'http://www.sitemaps.org/schemas/sitemap/0.9'}
    tree=ET.fromstring(xml)
    urls=[n.text for n in tree.findall('s:url/s:loc',ns)]
    for child in tree.findall('s:sitemap/s:loc',ns):
        urls.extend(n.text for n in ET.fromstring(fetch(child.text)).findall('s:url/s:loc',ns))
    (ROOT/'data/legacy-urls.json').write_text(json.dumps(urls,indent=2))
    print('Sitemap URLs:',len(urls),flush=True)
    results=[]; failures=[]
    def extract(url):
        try:
            html=fetch(url); tree=Tree(html).root
            h1=next((n.text() for n in tree.walk() if n.tag=='h1'), '')
            content=next((n for n in tree.walk() if 'entry-content' in n.attrs.get('class','').split()),None)
            article=next((n for n in tree.walk() if n.tag=='article'),None)
            published=next((n.attrs.get('content') for n in tree.walk() if n.attrs.get('property')=='article:published_time'),None)
            # Save one representative page for auditing extraction selectors.
            if content is None and article: content=article
            blocks=[]
            if content:
                for n in content.walk():
                    if n.tag in ['h2','h3','h4','p','li'] and n.text():
                        blocks.append({'type':'h2' if n.tag.startswith('h') else 'p','text':n.text()})
            return {'url':url,'path':urlparse(url).path,'title':h1,'published':published,'blocks':blocks,'hasArticle':bool(article),'classes':list(dict.fromkeys(n.attrs.get('class','') for n in tree.walk() if n.tag in ['main','article']))}
        except Exception as e: return {'url':url,'error':str(e)}
    with ThreadPoolExecutor(max_workers=4) as pool:
        for r in pool.map(extract,urls):
            (failures if 'error' in r else results).append(r)
    (ROOT/'data/legacy-crawl.json').write_text(json.dumps(results,indent=2))
    (ROOT/'data/legacy-crawl-failures.json').write_text(json.dumps(failures,indent=2))
    print('Crawled:',len(results),'failures:',len(failures),flush=True)
    print(json.dumps([{'path':r['path'],'title':r['title'],'date':r['published'],'blocks':len(r['blocks']),'article':r['hasArticle']} for r in results],indent=2))
