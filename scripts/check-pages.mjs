import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../dist-pages/',import.meta.url));
const manifest=JSON.parse(await readFile(path.join(root,'manifest.json'),'utf8'));
const base=new URL(manifest.siteUrl).pathname.replace(/\/$/,'');
async function checkUrl(raw,from){
  if(!raw.startsWith('/')||raw.startsWith('//'))return;
  const url=new URL(raw.replaceAll('&amp;','&'),'https://preview.test');
  assert(url.pathname.startsWith(base+'/'),`${from}: URL escapes project path: ${raw}`);
  const file=path.join(root,decodeURIComponent(url.pathname.slice(base.length)));
  const info=await stat(file).catch(()=>null);assert(info,`${from}: missing ${raw}`);
  if(info.isDirectory())await stat(path.join(file,'index.html'));
}
let pages=0,assets=0;
async function check(dir){for(const entry of await readdir(dir,{withFileTypes:true})){
 const file=path.join(dir,entry.name);if(entry.isDirectory()){await check(file);continue;}
 if(entry.name.endsWith('.html')){
  pages++;const html=await readFile(file,'utf8');
  assert(!html.includes('id="consultation-form"'),`${file}: static preview cannot submit a form`);
  for(const m of html.matchAll(/\b(?:href|src|poster|action|data-small|data-large|data-src|data-poster)="([^"]+)"/g))await checkUrl(m[1],file);
  for(const m of html.matchAll(/\b(?:srcset|data-srcset)="([^"]+)"/g))for(const candidate of m[1].split(','))await checkUrl(candidate.trim().split(/\s+/)[0],file);
 }
 if(entry.name.endsWith('.js')){
  const js=await readFile(file,'utf8');
  for(const m of js.matchAll(/['"`]((?:\/[^'"`\s]*)?\/assets\/[^'"`\s]+)['"`]/g)){await checkUrl(m[1],file);assets++;}
 }
}}
await check(root);
const home=await readFile(path.join(root,'index.html'),'utf8');
assert.match(home,/id="home-world"/);assert.match(home,/noindex/);
assert.equal([...home.matchAll(/<h1(?:>| )/g)].length,1);
assert.equal(manifest.pages.length,54);
console.log(`Pages checks passed: ${pages} documents, responsive assets, ${assets} script asset references, project paths, and contact fallback.`);
