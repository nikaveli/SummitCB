import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
import {createServer} from '../server.mjs';
import {paths} from '../src/config.mjs';
const out='artifacts/section-choreography';await mkdir(out,{recursive:true});
const server=await createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
const errors=[],report={};page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
async function snap(name){await page.screenshot({path:`${out}/${name}.png`});}
async function scroll(y){await page.evaluate(y=>window.scrollTo(0,y),y);await page.waitForTimeout(1000);}
async function top(selector){return page.locator(selector).evaluate(el=>el.getBoundingClientRect().top+scrollY);}
try{
 await page.goto(base+paths.services);await page.waitForTimeout(350);
 assert.equal(await page.locator('.service-chapter').count(),2);
 const first=await top('.service-feature:first-child');
 for(const [label,offset] of [['entry',-450],['held',100],['release',850]]){await scroll(first+offset);await snap('service-'+label);}
 const second=await top('.service-feature--reverse');
 for(const [label,offset] of [['entry',-450],['held',100],['release',850]]){await scroll(second+offset);await snap('service-reverse-'+label);}
 const mask=page.locator('.service-feature--reverse h2');
 assert.equal(await mask.getAttribute('aria-label'),'Home Remodeling & Home Improvement');
 assert.ok(await mask.locator('.summit-line').count()>1);
 const sticky=[];for(const offset of [50,220]){await scroll(first+offset);sticky.push(await page.locator('.service-feature-photo').first().evaluate(el=>el.getBoundingClientRect().top));}
 assert.ok(Math.abs(sticky[0]-sticky[1])<2,JSON.stringify(sticky));
 report.services='Two alternating image holds, headline lines, native scroll release';
 console.log('Service choreography passed');

 await page.goto(base+paths.process);await page.waitForTimeout(350);
 assert.equal(await page.locator('.process-story').count(),1);
 const frames=[];
 for(let i=0;i<5;i++){
  const y=await page.locator('.process-list>li').nth(i).evaluate(el=>el.getBoundingClientRect().top+scrollY-innerHeight*.3);
  await scroll(y);await snap(`process-${i+1}`);
  const clip=await page.locator('.process-frame').nth(i).evaluate(el=>getComputedStyle(el).clipPath);
  if(i)assert.equal(clip,'inset(0%)');
  frames.push({i,clip});
 }
 await scroll(await page.locator('.process-list>li').nth(1).evaluate(el=>el.getBoundingClientRect().top+scrollY-innerHeight*.3));
 assert.equal(await page.locator('.process-frame').last().evaluate(el=>getComputedStyle(el).clipPath),'inset(100% 0% 0%)');
 report.process={frames,reverse:'Later frames conceal again on reverse scroll'};
 console.log('Process choreography passed');

 await page.goto(base+paths.projects);await page.waitForTimeout(400);
 const range=await page.evaluate(()=>{const st=ScrollTrigger.getById('project-showcase');return {start:st.start,end:st.end,travel:document.querySelector('.gallery-updated').scrollWidth-document.querySelector('.showcase-stage').clientWidth};});
 assert.ok(range.travel>600);
 for(const p of [0,.2,.4,.6,.8,1]){await scroll(range.start+(range.end-range.start)*p);await snap('projects-'+Math.round(p*100));}
 const edge=await page.locator('.gallery-updated>.photo-figure').last().evaluate(el=>({right:el.getBoundingClientRect().right,viewport:document.querySelector('.showcase-stage').getBoundingClientRect().right}));
 assert.ok(Math.abs(edge.right-edge.viewport)<3,JSON.stringify(edge));
 await scroll(range.end+600);await snap('projects-exit');
 await scroll(range.start);await snap('projects-reverse');
 report.projects={...range,lastPhoto:edge};
 console.log('Project showcase passed');

 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(400);
 assert.equal(await page.locator('.showcase-pan').count(),0);assert.equal(await page.locator('.pin-spacer').count(),0);assert.equal(await page.evaluate(()=>ScrollTrigger.getAll().length),0);
 await page.locator('.original-gallery').scrollIntoViewIfNeeded();await snap('projects-reduced');
 await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(400);assert.equal(await page.locator('.showcase-pan').count(),1);
 await page.emulateMedia({media:'print'});await page.waitForTimeout(350);assert.equal(await page.locator('.pin-spacer').count(),0);
 await page.emulateMedia({media:'screen'});
 report.preferences='Live preference and print changes restore the ordinary photo grid and remove pin spacers';

 for(const width of [1440,1100,1024,800,390,320]){
  await page.setViewportSize({width,height:900});
  for(const url of [paths.services,paths.process,paths.projects,'/home-additions/',paths.resources,paths.contact]){
   await page.goto(base+url);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${width} ${url}`);
  }
 }
 await page.setViewportSize({width:390,height:844});
 for(const [name,url] of [['services',paths.services],['process',paths.process],['projects',paths.projects]]){
  await page.goto(base+url);assert.equal(await page.locator('.pin-spacer,.process-story,.service-chapter').count(),0);
  const el=name==='projects'?'.original-gallery':name==='process'?'.process-deck':'.service-feature--reverse';
  await page.locator(el).scrollIntoViewIfNeeded();await page.waitForTimeout(1000);await snap(name+'-mobile');
 }
 report.responsive='No overflow at 1440, 1100, 1024, 800, 390, 320; no held stages on mobile';

 const plain=await browser.newContext({javaScriptEnabled:false});const nojs=await plain.newPage();
 await nojs.goto(base+paths.process);assert.equal(await nojs.locator('.process-frame:visible').count(),5);
 await nojs.goto(base+paths.projects);assert.equal(await nojs.locator('.gallery-updated .photo-figure:visible').count(),6);
 report.nojs='All five process photos and all six showcase photos visible without JavaScript';
 assert.deepEqual(errors,[]);report.errors=errors;await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
