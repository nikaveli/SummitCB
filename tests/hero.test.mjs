import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from '../server.mjs';

test('Homepage hero assets are served under CSP and remain isolated from other pages',async()=>{
 const server=await createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}`;
 try{
  const home=await fetch(base+'/');const html=await home.text();
  assert.match(home.headers.get('content-security-policy'),/media-src 'self' blob:/);
  assert.match(home.headers.get('content-security-policy'),/script-src 'self'; style-src 'self';/);
  assert.equal([...html.matchAll(/<h1(?:>| )/g)].length,1);
  assert.match(html,/id="home-world"/);assert.match(html,/id="home-content"/);
  for(const [file,type] of [['hero.css','text/css'],['scrub-engine.js','text/javascript'],['hero.js','text/javascript'],['light-clean-poster.jpg','image/jpeg'],['detail-hq-v3-scrub.mp4','video/mp4']]){
   const response=await fetch(base+'/assets/scroll-hero/'+file,{method:'HEAD'});
   assert.equal(response.status,200,file);assert(response.headers.get('content-type').startsWith(type),file);
  }
  const heroScript=await readFile('public/assets/scroll-hero/hero.js','utf8');
  const heroCss=await readFile('public/assets/scroll-hero/hero.css','utf8');
  const wrangler=JSON.parse(await readFile('wrangler.jsonc','utf8'));
  assert.match(heroScript,/light-hq-v3-scrub\.mp4/);
  assert.ok(!heroCss.includes('.sw-scene__still{transform:none!important}'),'still-image fallback must respond before video is ready');
  assert.ok(wrangler.assets.run_worker_first.includes('!/assets/*.mp4'),'MP4 assets must bypass the Worker so Cloudflare preserves byte-range streaming');
  for(const file of ['light-hq-v3-scrub.mp4','detail-hq-v3-scrub.mp4','retreat-hq-v3-scrub.mp4']){
   const bytes=await readFile('public/assets/scroll-hero/'+file);
   assert.ok(bytes.length<4000000,`${file} exceeds the startup transfer budget`);
   const atoms=[];let offset=0;
   while(offset+8<=bytes.length){const size=bytes.readUInt32BE(offset);atoms.push(bytes.toString('ascii',offset+4,offset+8));if(size<8)break;offset+=size;}
   assert.ok(atoms.indexOf('moov')>=0&&atoms.indexOf('moov')<atoms.indexOf('mdat'),`${file} must use fast-start metadata`);
  }
  const other=await fetch(base+'/home-additions/');const otherHtml=await other.text();
  assert(!other.headers.get('content-security-policy').includes('blob:'));
  assert(!otherHtml.includes('/assets/scroll-hero/'));
  assert.match(otherHtml,/class="site-header"/);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r))}
});
