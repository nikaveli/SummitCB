import assert from 'node:assert/strict';
import { createServer } from '../server.mjs';
import { paths } from '../src/config.mjs';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=await createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});

async function setup(options={}){
  const context=await browser.newContext({viewport:{width:1440,height:1000},...options});
  const page=await context.newPage(),requests=[],errors=[];
  page.on('request',request=>{if(request.url().includes('/project-films/')&&request.url().endsWith('.mp4'))requests.push(request.url());});
  page.on('pageerror',error=>errors.push(error.message));
  return {context,page,requests,errors};
}

try{
  const desktop=await setup();await desktop.page.goto(base+paths.projects);await desktop.page.waitForTimeout(500);
  assert.equal(await desktop.page.locator('.project-film-section').count(),14);
  assert.equal(await desktop.page.locator('[data-project-film]').count(),16);
  assert.equal(await desktop.page.locator('#project-york [data-project-film]').count(),3);
  assert.equal(desktop.requests.length,0,'videos must not load before interaction');
  assert.equal(await desktop.page.locator('[data-project-film="64th"] video').evaluate(video=>getComputedStyle(video).opacity),'0');
  assert.equal(await desktop.page.locator('[data-project-film="64th"] img').evaluate(image=>getComputedStyle(image).opacity),'1');
  const widths=await desktop.page.locator('.project-film-media').evaluateAll(items=>items.map(item=>Math.round(item.getBoundingClientRect().width)));
  assert.equal(new Set(widths).size,1,'every project video must use the same width');
  const first=desktop.page.locator('[data-project-film="64th"] .project-film-media');
  await first.hover();await desktop.page.waitForFunction(()=>document.querySelector('[data-project-film="64th"] video').currentTime>.15);
  assert.ok(desktop.requests.every(url=>url.includes('-720-')));assert.equal(await first.getAttribute('aria-label'),'Pause Puspa project video');
  assert.equal(await first.locator('video').evaluate(video=>getComputedStyle(video).opacity),'1');
  await desktop.page.mouse.move(0,0);await desktop.page.waitForFunction(()=>!document.querySelector('[data-project-film="64th"] video').getAttribute('src'));
  await desktop.page.locator('.project-index a[href="#project-york"]').click();
  await desktop.page.waitForTimeout(250);assert.equal(await desktop.page.evaluate(()=>location.hash),'#project-york');
  const yorkTop=await desktop.page.locator('#project-york').evaluate(element=>element.getBoundingClientRect().top);assert.ok(yorkTop>=0&&yorkTop<220);
  assert.deepEqual(desktop.errors,[]);await desktop.context.close();

  const mobile=await setup({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:3});
  await mobile.page.goto(base+paths.projects);await mobile.page.waitForTimeout(400);assert.equal(mobile.requests.length,0);
  const mobileFilm=mobile.page.locator('[data-project-film="64th"] .project-film-media');await mobileFilm.scrollIntoViewIfNeeded();await mobileFilm.tap();
  await mobile.page.waitForFunction(()=>document.querySelector('[data-project-film="64th"] video').currentTime>.15);
  assert.ok(mobile.requests.every(url=>url.includes('-480-')));await mobileFilm.tap();
  await mobile.page.waitForFunction(()=>!document.querySelector('[data-project-film="64th"] video').getAttribute('src'));
  assert.equal(await mobile.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.deepEqual(mobile.errors,[]);await mobile.context.close();

  const reduced=await setup({reducedMotion:'reduce'});await reduced.page.goto(base+paths.projects);
  const reducedFilm=reduced.page.locator('[data-project-film="64th"] .project-film-media');await reducedFilm.hover();await reduced.page.waitForTimeout(500);assert.equal(reduced.requests.length,0);
  await reducedFilm.click();await reduced.page.waitForFunction(()=>document.querySelector('[data-project-film="64th"] video').currentTime>.15);assert.equal(reduced.requests.length,1);await reduced.context.close();
  console.log('projects: 14 named sections, York group, equal sizing, hover, touch and reduced-motion playback passed');
}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
