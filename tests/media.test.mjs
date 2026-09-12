import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from '../server.mjs';
import { videoAssets } from '../src/video-assets.mjs';
import { motionFigure } from '../src/videos.mjs';

test('Films begin as responsive posters and have no eager media source',()=>{
  const html=motionFigure('island');
  const tag=html.match(/<video[^>]+>/)[0];
  assert.match(tag,/preload="none"/);assert.ok(!/\ssrc=|autoplay|loop/.test(tag));
  assert.ok(html.includes('<noscript>'));assert.ok(html.includes('motion-toggle'));
});
test('Optimized films have fast-start metadata and fit their transfer budgets',async()=>{
  for(const variants of Object.values(videoAssets))for(const [quality,asset]of Object.entries(variants)){
    const file=await readFile('public'+asset.url);assert.equal(file.length,asset.bytes);
    assert.ok(file.length<(quality==='480'?750000:1300000),asset.url);
    const atoms=[];let offset=0;
    while(offset+8<=file.length){const size=file.readUInt32BE(offset);atoms.push(file.toString('ascii',offset+4,offset+8));if(size<8)break;offset+=size;}
    assert.ok(atoms.indexOf('moov')>=0&&atoms.indexOf('moov')<atoms.indexOf('mdat'),asset.url);
  }
});
test('Video responses support streaming ranges, HEAD, cache validation, and invalid ranges',async()=>{
  const server=await createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const asset=videoAssets.island[480],base=`http://127.0.0.1:${server.address().port}`;
  const bytes=await readFile('public'+asset.url);
  try{
    const partial=await fetch(base+asset.url,{headers:{Range:'bytes=12-45'}});
    assert.equal(partial.status,206);assert.equal(partial.headers.get('content-type'),'video/mp4');
    assert.equal(partial.headers.get('content-range'),`bytes 12-45/${bytes.length}`);
    assert.deepEqual(Buffer.from(await partial.arrayBuffer()),bytes.subarray(12,46));
    const suffix=await fetch(base+asset.url,{headers:{Range:'bytes=-16'}});assert.equal(suffix.status,206);assert.deepEqual(Buffer.from(await suffix.arrayBuffer()),bytes.subarray(-16));
    const head=await fetch(base+asset.url,{method:'HEAD'});assert.equal(head.status,200);assert.equal(Number(head.headers.get('content-length')),bytes.length);assert.equal(await head.text(),'');
    assert.match(head.headers.get('cache-control'),/immutable/);
    const cached=await fetch(base+asset.url,{headers:{'If-None-Match':head.headers.get('etag')}});assert.equal(cached.status,304);
    for(const range of [`bytes=${bytes.length}-`,'bytes=8-2','bytes=0-2,5-8','bytes=-0']){
      const r=await fetch(base+asset.url,{headers:{Range:range}});assert.equal(r.status,416,range);assert.equal(r.headers.get('content-range'),`bytes */${bytes.length}`);
    }
    const full=await fetch(base+asset.url,{headers:{Range:'bytes=0-2','If-Range':'"different-version"'}});assert.equal(full.status,200);assert.equal((await full.arrayBuffer()).byteLength,bytes.length);
    assert.equal((await fetch(base+'/assets/missing-film.mp4')).status,404);
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
