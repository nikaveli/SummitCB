import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const manifest=JSON.parse(await readFile(path.join(root,'dist/manifest.json'),'utf8'));
test('Every page has responsive photography; image and share-preview URLs exist',async()=>{
  for(const page of manifest.pages){
    const html=await readFile(path.join(root,'dist',page.path,'index.html'),'utf8');
    assert.ok(html.includes('<picture'),page.path);
    for(const match of html.matchAll(/<picture[\s\S]*?<\/picture>/g)){
      const picture=match[0];
      assert.match(picture,/width="1280" height="720"/);
      assert.match(picture,/loading="lazy" decoding="async" alt="/);
      const set=picture.match(/srcset="([^"]+)"/)[1].split(', ');
      assert.equal(set.length,4);
      for(const candidate of set){const [src]=candidate.split(' ');await stat(path.join(root,'dist',src));}
    }
    const preview=html.match(/<meta property="og:image" content="([^"]+)"/)[1];
    await stat(path.join(root,'dist',new URL(preview).pathname));
  }
});
test('Prepared web images stay below the full-size asset budget',async()=>{
  const report=JSON.parse(await readFile(path.join(root,'data/photo-assets.json'),'utf8'));
  assert.equal(report.length,28);
  for(const p of report){
    assert.equal(p.files.length,5);
    for(const file of p.files){
      assert.ok(file.bytes<700000,file.name+' is too large');
      assert.ok(file.bytes<p.originalBytes,file.name+' did not improve on the source');
    }
  }
});
