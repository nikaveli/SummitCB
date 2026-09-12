import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from '../server.mjs';
import { paths } from '../src/config.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=await createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});
const report={},errors=[];
async function setup(options={}) {
  const context=await browser.newContext({viewport:{width:1440,height:1000},...options});
  const page=await context.newPage(),requests=[];
  page.on('request',r=>{if(r.url().includes('.mp4'))requests.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
  return {context,page,requests};
}
try {
  const {page,requests}=await setup();await page.goto(base+paths.projects);await page.waitForTimeout(650);assert.equal(requests.length,0);
  assert.equal(await page.locator('.motion-study').count(),0);assert.equal(await page.locator('.gallery-item--film').count(),6);
  const wide=page.locator('.gallery-item:nth-child(7n+1)');assert.equal(await wide.count(),3);
  assert.equal(await wide.evaluateAll(items=>items.every(el=>el.classList.contains('gallery-item--film'))),true);
  const first=page.locator('[data-film=island]');await first.scrollIntoViewIfNeeded();await page.waitForTimeout(450);assert.equal(requests.length,0,'Scrolling must not load gallery films');
  await first.hover();await page.waitForFunction(()=>{const v=document.querySelector('[data-film=island] video');return v.currentTime>.15&&!v.paused;});
  assert.ok(requests.every(r=>r.includes('motion-island-720-')));
  await page.screenshot({path:'artifacts/gallery-film-desktop.png'});
  await page.mouse.move(0,0);await page.waitForFunction(()=>!document.querySelector('[data-film=island] video').getAttribute('src'));
  assert.equal(await first.evaluate(el=>el.classList.contains('is-previewing')),false);
  await first.focus();await page.waitForTimeout(250);const before=requests.length;
  await page.keyboard.press('Enter');await page.waitForFunction(()=>{const v=document.querySelector('.gallery-full-film');return !v.hidden&&v.currentTime>.1;});
  assert.equal(await page.locator('.photo-dialog').isVisible(),true);assert.equal(await page.locator('.gallery-full-film').getAttribute('controls'),'');
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.photo-dialog').open&&!document.querySelector('.gallery-full-film').getAttribute('src'));
  await page.waitForFunction(()=>document.activeElement===document.querySelector('[data-film=island]'));report.desktop='Zero initial/scroll video requests; hover plays, leave unloads; keyboard opens viewer';
  await page.locator('[data-photo-filter=kitchen]').click();assert.equal(await page.locator('.gallery-item:visible').count(),9);
  await page.locator('[data-photo-filter=all]').click();
  const small=page.locator('[data-film=detail]');await small.hover();await page.waitForFunction(()=>{const v=document.querySelector('[data-film=detail] video');return v.currentTime>.1;});
  assert.ok(await small.locator('video').evaluate(v=>v.currentSrc.includes('-480-')));await page.mouse.move(0,0);
  const mobile=await setup({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
  await mobile.page.goto(base+paths.projects);await mobile.page.locator('[data-film=island]').scrollIntoViewIfNeeded();await mobile.page.waitForTimeout(500);assert.equal(mobile.requests.length,0);
  await mobile.page.locator('[data-film=island]').click();await mobile.page.waitForFunction(()=>{const v=document.querySelector('[data-film=island] video');return v.currentTime>.1&&!v.paused;});
  assert.ok(mobile.requests.every(r=>r.includes('-480-')));await mobile.page.screenshot({path:'artifacts/gallery-film-mobile-viewer.png'});
  assert.equal(await mobile.page.locator('.photo-dialog').isVisible(),false);await mobile.page.locator('.gallery-film-toggle').first().click();assert.equal(await mobile.page.locator('[data-film=island] video').evaluate(v=>v.paused),true);await mobile.page.locator('.photo-gallery').screenshot({path:'artifacts/gallery-film-mobile.png'});report.mobile='Tap plays one 480p film inline; pause works; no modal or hover/scroll download';
  for(const mode of ['reduced-motion','save-data','slow-connection']){
    const env=await setup(mode==='reduced-motion'?{reducedMotion:'reduce'}:{});
    if(mode!=='reduced-motion')await env.context.addInitScript(({saveData,effectiveType})=>{const c=new EventTarget();Object.assign(c,{saveData,effectiveType});Object.defineProperty(navigator,'connection',{configurable:true,value:c});},{saveData:mode==='save-data',effectiveType:mode==='slow-connection'?'3g':'4g'});
    await env.page.goto(base+paths.projects);await env.page.locator('[data-film=island]').hover();await env.page.waitForTimeout(600);assert.equal(env.requests.length,0,mode);
    await env.page.locator('[data-film=island]').click();await env.page.waitForFunction(()=>document.querySelector('.gallery-full-film').currentTime>.1);report[mode]='Hover remains still; explicit playback works';await env.context.close();
  }
  const plain=await setup({javaScriptEnabled:false});await plain.page.goto(base+paths.projects);assert.equal(plain.requests.length,0);const url=await plain.page.locator('[data-film=island]').getAttribute('href');const direct=await plain.page.request.get(base+url);assert.equal(direct.headers()['content-type'],'video/mp4');report.noJavaScript='Direct film link works';
  const stable=await setup({reducedMotion:'reduce'});
  for(const width of [1440,390,320]){await stable.page.setViewportSize({width,height:1000});for(const url of ['/',paths.services,paths.projects,'/home-additions/',paths.process]){await stable.page.goto(base+url);assert.equal(await stable.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${width} ${url}`);}}
  const source=await readFile('dist/index.html','utf8');assert.ok(source.includes('id="home-world"'));assert.ok(source.includes('/assets/scroll-hero/hero.js'));report.hero='Approved scroll hero installed; separate homepage integration checks cover scrolling';
  assert.deepEqual(errors,[]);report.widths=[1440,390,320];
  await writeFile('artifacts/motion-browser-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
