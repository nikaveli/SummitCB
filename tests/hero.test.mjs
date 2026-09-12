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
  for(const [file,type] of [['hero.css','text/css'],['scrub-engine.js','text/javascript'],['hero.js','text/javascript'],['light-clean-poster.jpg','image/jpeg'],['detail-clear-v2-m.mp4','video/mp4']]){
   const response=await fetch(base+'/assets/scroll-hero/'+file,{method:'HEAD'});
   assert.equal(response.status,200,file);assert(response.headers.get('content-type').startsWith(type),file);
  }
  const other=await fetch(base+'/home-additions/');const otherHtml=await other.text();
  assert(!other.headers.get('content-security-policy').includes('blob:'));
  assert(!otherHtml.includes('/assets/scroll-hero/'));
  assert.match(otherHtml,/class="site-header"/);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r))}
});
