import test from 'node:test';
import assert from 'node:assert/strict';
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
  assert.match(html,/data-sequence-wrap/);assert.match(html,/data-scroll-end="bottom bottom"/);
  assert(!html.includes('scrub-engine.js'));
  assert.match(html,/data-frames="137"/);
  for(const [file,type] of [['scroll-hero/hero.css','text/css'],['scroll-hero/hero.js','text/javascript'],['hero-sequence-v5/logo.webp','image/webp'],['hero-sequence-v5/desktop/frame-000.webp','image/webp'],['hero-sequence-v5/desktop/frame-136.webp','image/webp'],['hero-sequence-v5/mobile/frame-136.webp','image/webp']]){
   const response=await fetch(base+'/assets/'+file,{method:'HEAD'});
   assert.equal(response.status,200,file);assert(response.headers.get('content-type').startsWith(type),file);
  }
  const other=await fetch(base+'/home-additions/');const otherHtml=await other.text();
  assert(!other.headers.get('content-security-policy').includes('blob:'));
  assert(!otherHtml.includes('/assets/scroll-hero/'));
  assert.match(otherHtml,/class="site-header"/);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r))}
});
