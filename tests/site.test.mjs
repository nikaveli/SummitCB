import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createServer } from '../server.mjs';
import { deliverInquiry, readInquiries } from '../src/inquiries.mjs';
import { shell } from '../src/render.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const dist=path.join(root,'dist');
const manifest=JSON.parse(await readFile(path.join(dist,'manifest.json'),'utf8'));
const byPath=new Map(manifest.pages.map(p=>[p.path,p]));
const documents=new Map(await Promise.all(manifest.pages.map(async p=>[p.path,await readFile(path.join(dist,p.path,'index.html'),'utf8')])));
test('Page inventory contains the full approved launch scope and research additions',()=>{
  const count=type=>manifest.pages.filter(p=>p.type===type).length;
  assert.equal(count('service'),6);assert.equal(count('city'),6);assert.equal(count('local-service'),9);assert.equal(count('guide'),21);assert.equal(manifest.pages.length,54);
  assert.equal(new Set(manifest.pages.map(p=>p.title)).size,54);
});
test('Every page has one H1, unique metadata, canonical, and valid structured data',()=>{
  for(const [url,html] of documents) {
    assert.equal([...html.matchAll(/<h1(?:>| )/g)].length,1,url);
    assert.ok(html.includes('<html lang="en">'),url);
    assert.ok(html.includes(`rel="canonical" href="${manifest.siteUrl}${url}"`),url);
    assert.match(html,/<meta name="description" content="[^"]+">/);
    const schema=JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
    assert.equal(schema['@graph'].filter(x=>x['@type']==='GeneralContractor').length,1);
    if(byPath.get(url).type==='guide')assert.equal(schema['@graph'].filter(x=>x['@type']==='Article').length,1);
    assert.ok(!html.includes('SNJ Contracting'),url);
    assert.ok(!html.includes('561-779-9423'),url);
  }
});
test('Internal links and fragment targets resolve directly without redirects',async()=>{
  for(const [url,html] of documents)for(const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const raw=match[1].replaceAll('&amp;','&');
    if(!raw.startsWith('/')&&!raw.startsWith('#'))continue;
    const link=new URL(raw,'https://test.local'+url);
    if(link.pathname.startsWith('/assets/')){await access(path.join(dist,link.pathname));continue;}
    assert.ok(byPath.has(link.pathname),`${url} -> ${raw}`);
    assert.ok(!manifest.redirects[link.pathname],`${url} links through a redirect: ${raw}`);
    if(link.hash)assert.ok(documents.get(link.pathname).includes(`id="${decodeURIComponent(link.hash.slice(1))}"`),`${url} -> missing ${raw}`);
  }
});
test('All legacy sitemap entries have valid direct migration outcomes',async()=>{
  const old=JSON.parse(await readFile(path.join(root,'data/legacy-urls.json'),'utf8'));
  const rows=JSON.parse(await readFile(path.join(root,'data/migration-map.json'),'utf8'));
  assert.equal(rows.length,old.length);
  for(const from of old){const u=new URL(from),key=u.pathname+u.search;const row=rows.find(r=>r.from===key);assert.ok(row,key);if(row.status===200)assert.ok(byPath.has(row.to));else assert.ok(byPath.has(row.to)||row.to.startsWith('/assets/'));}
  for(const [from,to]of Object.entries(manifest.redirects)){assert.notEqual(from,to);assert.ok(!manifest.redirects[to],from+' chains');assert.ok(byPath.has(to)||['/assets/logo.png','/sitemap.xml'].includes(to));}
});
test('Confirmation and privacy stay out of sitemap; production is indexable and previews are not',async()=>{
  const xml=await readFile(path.join(dist,'sitemap.xml'),'utf8');
  assert.ok(!xml.includes('/thank-you/'));assert.ok(!xml.includes('/privacy-policy/'));
  for(const p of manifest.pages.filter(p=>!p.noindex))assert.ok(xml.includes(manifest.siteUrl+p.path),p.path);
  const previous=process.env.PUBLIC_INDEXING;
  try {
    process.env.PUBLIC_INDEXING='true';assert.match(shell({path:'/',title:'Test',description:'Test'},'<h1>Test</h1>'),/content="index, follow/);
    assert.match(shell({path:'/thank-you/',title:'Thanks',description:'Saved',noindex:true},'<h1>Thanks</h1>'),/content="noindex, follow/);
    process.env.PUBLIC_INDEXING='false';assert.match(shell({path:'/',title:'Test',description:'Test'},'<h1>Test</h1>'),/content="noindex, follow/);
  }finally {if(previous===undefined)delete process.env.PUBLIC_INDEXING;else process.env.PUBLIC_INDEXING=previous;}
});

const valid={name:'Test Homeowner',email:'test@example.com',phone:'720-555-0123',city:'arvada',service:'additions',timing:'Exploring',message:'Test inquiry: exploring an addition to the home.',landingPath:'/home-additions/',referringHost:'www.google.com',website:''};
async function withServer(fn,options={}){
  const dir=await mkdtemp(path.join(os.tmpdir(),'summit-inquiries-'));
  const server=await createServer({inquiryDirectory:dir,...options});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const base=`http://127.0.0.1:${server.address().port}`;
  const submit=(data=valid,headers={})=>fetch(base+'/api/inquiries',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json',Origin:base,...headers},body:new URLSearchParams(data),redirect:'manual'});
  try {await fn({base,submit,dir,server});}finally{await server.drain();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});}
}
test('A real submission is durably stored with service/city/organic attribution',async()=>{
  await withServer(async({submit,dir,server})=>{
    const r=await submit();assert.equal(r.status,201);assert.equal((await r.json()).saved,true);await server.drain();
    const records=await readInquiries(dir);assert.equal(records.length,1);assert.equal(records[0].service,'additions');assert.equal(records[0].city,'arvada');assert.equal(records[0].channel,'organic');assert.equal(records[0].delivery.status,'stored-locally');
    assert.ok(!('ip' in records[0]));
  });
});
test('Invalid input, cross-site requests, and honeypot submissions never create leads',async()=>{
  await withServer(async({submit,dir})=>{
    const invalid=await submit({...valid,email:'invalid',city:'not-served',message:'short'});assert.equal(invalid.status,422);const data=await invalid.json();assert.ok(data.errors.email&&data.errors.city&&data.errors.message);
    assert.equal((await submit(valid,{Origin:'https://unrelated.example'})).status,403);
    assert.equal((await submit({...valid,website:'spam'})).status,422);
    assert.deepEqual(await readInquiries(dir),[]);
  });
});
test('Native HTML form succeeds without JavaScript and validation preserves entered text safely',async()=>{
  await withServer(async({submit})=>{
    const ok=await submit(valid,{Accept:'text/html'});assert.equal(ok.status,303);assert.equal(ok.headers.get('location'),'/thank-you/');
    const bad=await submit({...valid,name:'<script>alert(1)</script>',email:'invalid'},{Accept:'text/html'});assert.equal(bad.status,422);const html=await bad.text();assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('aria-invalid="true"'));assert.ok(!html.includes('<script>alert(1)</script>'));assert.ok(html.includes(valid.message));
  });
});
test('A storage failure returns no success confirmation',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'summit-failure-'));const file=path.join(dir,'not-a-directory');await writeFile(file,'x');
  try {await withServer(async({submit})=>{const r=await submit();assert.equal(r.status,503);assert.equal((await r.json()).saved,false);},{inquiryDirectory:file});}finally{await rm(dir,{recursive:true,force:true});}
});
test('Failed remote delivery retains the lead for retry; delivery uses idempotency keys',async()=>{
  let request;
  await withServer(async({submit,dir,server})=>{
    assert.equal((await submit()).status,201);await server.drain();const [record]=await readInquiries(dir);assert.equal(record.delivery.status,'failed');assert.equal(request.headers['Idempotency-Key'],record.id);
    const delivered=await deliverInquiry(record,dir,{webhookUrl:'https://example.com/inquiry',fetchImpl:async(url,init)=>{assert.equal(init.headers['Idempotency-Key'],record.id);return {ok:true,status:200};}});
    assert.equal(delivered,true);const records=await readInquiries(dir);assert.equal(records.length,1);assert.equal(records[0].delivery.status,'delivered');
  },{webhookUrl:'https://example.com/inquiry',fetchImpl:async(url,init)=>{request=init;return {ok:false,status:503};}});
});
test('Request limits, private-file protection, and actual redirects work over HTTP',async()=>{
  await withServer(async({base,submit})=>{
    assert.equal((await fetch(base+'/data/legacy-crawl.json')).status,404);
    assert.equal((await fetch(base+'/.env')).status,404);
    assert.equal((await fetch(base+'/does-not-exist/')).status,404);
    const r=await fetch(base+'/services',{redirect:'manual'});assert.equal(r.status,301);assert.equal(r.headers.get('location'),manifest.redirects['/services/']);
    const page=await fetch(base+'/service-areas/morrison-co/');assert.equal(page.status,200);assert.ok((await page.text()).includes('municipal status'));
    const head=await fetch(base+'/home-additions/',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
    await submit();assert.equal((await submit()).status,429);
  },{rateLimit:1});
});
