import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { createServer } from '../server.mjs';
import { paths } from '../src/config.mjs';
const raw=(url,encoding)=>new Promise((resolve,reject)=>http.get(url,{headers:{'Accept-Encoding':encoding}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));}).on('error',reject));
test('Text responses negotiate compression and versioned code uses immutable caching',async()=>{
  const server=await createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
  try{
    const original=await readFile('dist'+paths.services+'index.html');
    const br=await raw(base+paths.services,'br');assert.equal(br.headers['content-encoding'],'br');assert.deepEqual(brotliDecompressSync(br.body),original);assert.ok(br.body.length<original.length*.35);
    const gz=await raw(base+paths.services,'br;q=0,gzip;q=1');assert.equal(gz.headers['content-encoding'],'gzip');assert.deepEqual(gunzipSync(gz.body),original);
    const plain=await raw(base+paths.services,'br;q=0,gzip;q=0');assert.equal(plain.headers['content-encoding'],undefined);assert.deepEqual(plain.body,original);
    const css=original.toString().match(/href="(\/assets\/site\.css\?v=[a-f0-9]+)"/)[1];const asset=await raw(base+css,'br');assert.match(asset.headers['cache-control'],/immutable/);assert.equal(asset.headers.vary,'Accept-Encoding');
    const stale=await raw(base+'/assets/site.css?v=old','br');assert.equal(stale.headers['cache-control'],'no-cache');
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
