import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { projectVideoAssets } from '../src/project-video-assets.mjs';
import { projectVideoGroups } from '../src/project-video-catalog.mjs';

test('Projects page is organized by project name with York grouped together',async()=>{
  const html=await readFile('dist/our-projects/index.html','utf8');
  assert.equal(projectVideoGroups.length,14);
  assert.equal(projectVideoGroups.flatMap(group=>group.clips).length,16);
  assert.equal((html.match(/class="project-film-section"/g)||[]).length,14);
  assert.equal((html.match(/data-project-film=/g)||[]).length,16);
  assert.equal((html.match(/data-project-scale/g)||[]).length,16);
  assert.equal((html.match(/data-flip-element="wrapper"/g)||[]).length,32);
  assert.equal((html.match(/data-flip-element="target"/g)||[]).length,16);
  assert.match(html,/\/assets\/flip\.min\.js/);
  assert.equal((html.match(/class="project-index"/g)||[]).length,1);
  assert.equal(projectVideoGroups.find(group=>group.id==='york').clips.length,3);
  for(const [id,title,detail] of [['puspa','Puspa','open kitchen'],['chase','Chase','full interior remodel'],['marion','Marion','new basement'],['marshall','Marshall','pop-top addition'],['pearl','Pearl St','primary bathroom'],['york','York','large home addition']]){
    const group=projectVideoGroups.find(project=>project.id===id);assert.equal(group.title,title);assert.ok(group.support.toLowerCase().includes(detail),id);
  }
  assert.ok(!html.includes('data-photo-filter'));
  assert.ok(html.includes('/assets/site.js'));
  assert.ok((await readFile('public/assets/site.js','utf8')).includes("import('/assets/project-videos.js')"));
  for(const group of projectVideoGroups)assert.ok(html.includes(`href="#project-${group.id}"`),group.id);
});

test('Project films are responsive, demand-loaded, and prepared for streaming',async()=>{
  for(const [id,asset] of Object.entries(projectVideoAssets)){
    assert.ok(asset[480]&&asset[720]&&asset.poster,id);
    assert.equal(asset[480].height,480);assert.equal(asset[720].height,720);
    assert.ok(asset[480].bytes<3_500_000,`${id} mobile transfer`);
    assert.ok(asset[720].bytes<6_500_000,`${id} desktop transfer`);
    for(const version of [asset[480],asset[720]]){
      const file=await readFile('public'+version.url);assert.equal(file.length,version.bytes);
      const atoms=[];let offset=0;
      while(offset+8<=file.length){const size=file.readUInt32BE(offset);atoms.push(file.toString('ascii',offset+4,offset+8));if(size<8)break;offset+=size;}
      assert.ok(atoms.indexOf('moov')>=0&&atoms.indexOf('moov')<atoms.indexOf('mdat'),version.url);
    }
    assert.equal((await readFile('public'+asset.poster.url)).length,asset.poster.bytes);
  }
});
