import { mkdir, rm, writeFile, readFile, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';
import { services, serviceById } from '../src/content/services.mjs';
import { cities, localServices } from '../src/content/cities.mjs';
import { guides, guideById } from '../src/content/guides.mjs';
import { legacyArticles } from '../src/content/legacy.mjs';
import { renderCompanyPages, renderService, renderCity, renderLocal, renderGuide, renderSitemap, render404 } from '../src/render.mjs';
import { site, paths } from '../src/config.mjs';
import { escapeHtml } from '../src/html.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const dist=path.resolve(root,process.env.BUILD_DIR || 'dist');
const writeReports=process.env.WRITE_REPORTS!=='false';
const legacy=JSON.parse(await readFile(path.join(root,'data/legacy-crawl.json'),'utf8'));
for(const g of guides) {
  const previous=legacy.find(x=>x.path===g.path&&x.classes.some(c=>c.includes('type-post')));
  if(previous?.published)g.originalDate=previous.published.slice(0,10);
}
const results=[...renderCompanyPages(),...services.map(renderService),...cities.map(renderCity),...localServices.map(renderLocal),...[...guides,...legacyArticles].map(renderGuide)];
results.push(renderSitemap(results.map(r=>r.page)));
const pages=results.map(r=>r.page);
const known=new Set(pages.map(p=>p.path));
if(known.size!==pages.length)throw new Error('Duplicate page path');
if(new Set(pages.map(p=>p.title)).size!==pages.length)throw new Error('Duplicate title');
for(const p of pages)if(!/^\/(?:[a-z0-9-]+\/)*$/.test(p.path))throw new Error('Invalid output path '+p.path);

const redirects={
  '/blog-2/':paths.resources,
  '/services/':paths.services,'/about/':paths.about,'/contact/':paths.contact,'/projects/':paths.projects,
  '/home/':'/',
  '/sitemap_index.xml':'/sitemap.xml',
  '/wp-sitemap.xml':'/sitemap.xml',
  '/blog-for-home-improvement-kitchen-remodeling-bathroom-renovation-home-addition-and-ada-remodeling-in-lakewood-morrison-denver-arvada-golden-wheat-ridge-co-and-surrounding-areas/':paths.resources
};
for(const g of guides)if(g.plannedPath)redirects[g.plannedPath]=g.path;
const migration=[];
for(const old of legacy) {
  const url=new URL(old.url), key=url.pathname+url.search;
  if(url.search) {
    const destination=url.searchParams.has('slides') ? '/' : paths.projects;
    redirects[key]=destination;migration.push({from:key,status:301,to:destination,reason:'Legacy slider or media attachment; consolidated into its gallery/navigation context.'});continue;
  }
  if(known.has(old.path)) {migration.push({from:old.path,status:200,to:old.path,reason:old.classes.some(c=>c.includes('type-post'))?'Article retained and refreshed at original URL.':'Existing page retained at original URL.'});continue;}
  if(redirects[old.path]){migration.push({from:old.path,status:301,to:redirects[old.path],reason:'Duplicate navigation/archive consolidated.'});continue;}
  const isPost=old.classes.length===1&&old.classes[0].includes('type-post');
  if(isPost) {
    const text=old.blocks.map(b=>b.text).join(' ');
    let target=guideById['whole-home-plan'].path;
    if(/construction-company|general-contractor/.test(old.path))target=/Material distribution/.test(text)?serviceById.contractor.path:guideById['hiring-contractor'].path;
    else if(/home-addition/.test(old.path))target=/relocat|moving to|move to/i.test(text)?guideById['addition-vs-moving'].path:guideById['planning-addition'].path;
    else if(/bathroom/.test(old.path))target=guideById['bathroom-cost'].path;
    else if(/kitchen/.test(old.path))target=guideById['kitchen-cost'].path;
    const topicLines=old.blocks.filter(b=>b.text.length<180).map(b=>b.text).join(' ');
    if(/before hiring|before undertaking|while choosing|before making a choice|right home addition service|company offering|questions.*(?:service|company)|choosing a home remodeling|company are hiring/i.test(topicLines))target=guideById['hiring-contractor'].path;
    if(/hiring a good contractor for home addition/i.test(topicLines))target=guideById['hiring-contractor'].path;
    if(/benefits.*bathroom|Waterproof elements/i.test(topicLines))target=serviceById.bathroom.path;
    if(/benefits.*kitchen/i.test(topicLines))target=legacyArticles.find(p=>p.id==='kitchen-routines').path;
    if(/advantages of home remodeling|beneficial reasons for home improvement/i.test(topicLines))target=legacyArticles.find(p=>p.id==='remodel-priorities').path;
    redirects[old.path]=target;
    migration.push({from:old.path,status:301,to:target,reason:'Repetitive legacy article consolidated into the corresponding updated planning topic; original text retained in data/legacy-crawl.json.'});
  } else {
    const parent=old.path.slice(0,old.path.slice(0,-1).lastIndexOf('/')+1);
    let target=known.has(parent)&&parent!=='/'?parent:paths.projects;
    if(/logo|site-identity/.test(old.path))target='/assets/logo.png';
    else if(/kitchen/.test(old.path))target=serviceById.kitchen.path;
    else if(/bathroom/.test(old.path))target=serviceById.bathroom.path;
    redirects[old.path]=target;
    migration.push({from:old.path,status:301,to:target,reason:'Empty WordPress media attachment page consolidated into its relevant content or replacement asset.'});
  }
}
// Resolve all targets to the final destination; redirects must never form chains.
for(const from of Object.keys(redirects)) {
  let to=redirects[from];const seen=new Set([from]);
  while(redirects[to]){if(seen.has(to))throw new Error('Redirect loop: '+from);seen.add(to);to=redirects[to];}
  if(!known.has(to)&&!['/assets/logo.png','/sitemap.xml'].includes(to))throw new Error('Missing redirect target '+to);
  redirects[from]=to;
}
for(const row of migration)if(row.status===301)row.to=redirects[row.from];

await rm(dist,{recursive:true,force:true});await mkdir(dist,{recursive:true});await cp(path.join(root,'public'),dist,{recursive:true});
const assetRevisions={};
for(const name of ['site.css','site.js','motion.js','section-scroll.css','section-scroll.js','gsap.min.js','scroll-trigger.min.js','split-text.min.js','scroll-hero/hero.css','scroll-hero/scrub-engine.js','scroll-hero/hero.js'])assetRevisions['/assets/'+name]=createHash('sha256').update(await readFile(path.join(dist,'assets',name))).digest('hex').slice(0,12);
const revise=html=>html.replace(/(href|src)="(\/assets\/(?:site\.css|site\.js|motion\.js|section-scroll\.(?:css|js)|gsap\.min\.js|scroll-trigger\.min\.js|split-text\.min\.js|scroll-hero\/(?:hero\.css|scrub-engine\.js|hero\.js)))"/g,(_,attr,url)=>`${attr}="${url}?v=${assetRevisions[url]}"`);
for(const {page,html} of results) {
  const dir=path.join(dist,page.path);await mkdir(dir,{recursive:true});await writeFile(path.join(dir,'index.html'),revise(html));
}
await writeFile(path.join(dist,'404.html'),revise(render404()));
const indexable=pages.filter(p=>!p.noindex);
const htmlByPath=new Map(results.map(({page,html})=>[page.path,html]));
await writeFile(path.join(dist,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${indexable.map(p=>{const image=htmlByPath.get(p.path).match(/<meta property="og:image" content="([^"]+)"/)[1];return `<url><loc>${escapeHtml(site.url+p.path)}</loc><lastmod>${p.date||site.date}</lastmod><image:image><image:loc>${escapeHtml(image)}</image:loc></image:image></url>`;}).join('\n')}\n</urlset>\n`);
await writeFile(path.join(dist,'robots.txt'),process.env.PUBLIC_INDEXING==='true'?`User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${site.url}/sitemap.xml\n`:'User-agent: *\nDisallow: /\n');
const manifest={assetRevisions,built:site.date,indexing:process.env.PUBLIC_INDEXING==='true',siteUrl:site.url,pages:pages.map(p=>({path:p.path,title:p.title,description:p.description,type:p.type,noindex:!!p.noindex,service:p.service,city:p.city})),redirects};
await writeFile(path.join(dist,'manifest.json'),JSON.stringify(manifest,null,2));
if(writeReports) {
await writeFile(path.join(root,'data/migration-map.json'),JSON.stringify(migration,null,2));
await writeFile(path.join(root,'data/page-inventory.json'),JSON.stringify(manifest.pages,null,2));
await mkdir(path.join(root,'docs'),{recursive:true});
await writeFile(path.join(root,'docs/page-inventory.md'),'# Page inventory\n\nGenerated by `npm run build`. '+pages.length+' pages, including utility pages.\n\n| Page | Type | URL |\n|---|---|---|\n'+pages.map(p=>`| ${p.title.replaceAll('|','—')} | ${p.type} | [${p.path}](${site.url+p.path}) |`).join('\n')+'\n');
}
console.log(`Built ${pages.length} pages: 6 services, 6 cities, 9 local services, ${guides.length} launch/research guides, ${legacyArticles.length} retained articles, company and utility pages.`);
console.log(`Mapped ${migration.length} legacy sitemap entries; ${Object.keys(redirects).length} direct redirects. Indexing: ${manifest.indexing?'PRODUCTION':'PREVIEW (noindex)'}.`);

const compressed=[];
for(const url of [...pages.map(p=>p.path+'index.html'),'/404.html','/robots.txt','/sitemap.xml',...Object.keys(assetRevisions)]) {
  const file=path.join(dist,url),body=await readFile(file);
  const br=brotliCompressSync(body,{params:{[constants.BROTLI_PARAM_QUALITY]:6,[constants.BROTLI_PARAM_MODE]:constants.BROTLI_MODE_TEXT}}),gz=gzipSync(body,{level:9});
  await writeFile(file+'.br',br);await writeFile(file+'.gz',gz);
  compressed.push({url,original:body.length,brotli:br.length,gzip:gz.length});
}
if(writeReports) await writeFile(path.join(root,'data/transfer-sizes.json'),JSON.stringify(compressed,null,2));
console.log('Prepared Brotli/gzip text responses and versioned styles/scripts.');
