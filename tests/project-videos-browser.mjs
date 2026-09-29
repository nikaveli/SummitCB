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
  const compactSlot=desktop.page.locator('[data-project-film="64th"] .project-film-scale-slot--compact');
  const wideSlot=desktop.page.locator('[data-project-film="64th"] .project-film-scale-slot--wide');
  const firstHeading=desktop.page.locator('#project-puspa .project-film-heading');
  await compactSlot.evaluate(element=>scrollTo(0,scrollY+element.getBoundingClientRect().top+element.offsetHeight/2-innerHeight/2));await desktop.page.waitForTimeout(350);
  const compactWidth=(await first.boundingBox()).width;
  const compactGap=(await first.boundingBox()).y-((await firstHeading.boundingBox()).y+(await firstHeading.boundingBox()).height);
  await wideSlot.evaluate(element=>scrollTo(0,scrollY+element.getBoundingClientRect().top+element.offsetHeight/2-innerHeight*.6));await desktop.page.waitForTimeout(450);
  const expandedWidth=(await first.boundingBox()).width,wideWidth=(await wideSlot.boundingBox()).width;
  assert.ok(expandedWidth>compactWidth*1.5);assert.ok(Math.abs(expandedWidth-wideWidth)<5);
  const expandedGap=(await first.boundingBox()).y-((await firstHeading.boundingBox()).y+(await firstHeading.boundingBox()).height);
  assert.ok(Math.abs(expandedGap-compactGap)<3,'project title and description must stay attached to the video');
  const indexBox=await desktop.page.locator('.project-index').boundingBox();assert.ok((await firstHeading.boundingBox()).y>=indexBox.y+indexBox.height,'attached project copy must remain below the sticky project menu');
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
  const mobileFilm=mobile.page.locator('[data-project-film="64th"] .project-film-media');await mobileFilm.scrollIntoViewIfNeeded();
  await mobile.page.waitForFunction(()=>document.querySelector('[data-project-film="64th"] video').currentTime>.15);
  assert.ok(mobile.requests.every(url=>url.includes('-480-')));assert.equal(await mobileFilm.getAttribute('aria-label'),'Pause Puspa project video');
  const nextMobileFilm=mobile.page.locator('[data-project-film="bannock-01"] .project-film-media');await nextMobileFilm.scrollIntoViewIfNeeded();
  await mobile.page.waitForFunction(()=>document.querySelector('[data-project-film="bannock-01"] video').currentTime>.15);
  assert.equal(await mobileFilm.locator('video').getAttribute('src'),null);assert.equal(await mobile.page.locator('video[src]').count(),1);
  await nextMobileFilm.tap();await mobile.page.waitForFunction(()=>!document.querySelector('[data-project-film="bannock-01"] video').getAttribute('src'));
  assert.equal(await mobile.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.deepEqual(mobile.errors,[]);await mobile.context.close();

  const reduced=await setup({reducedMotion:'reduce'});await reduced.page.goto(base+paths.projects);
  assert.equal(await reduced.page.locator('html.has-project-flip').count(),0);
  const reducedFilm=reduced.page.locator('[data-project-film="64th"] .project-film-media');await reducedFilm.hover();await reduced.page.waitForTimeout(500);assert.equal(reduced.requests.length,0);
  await reducedFilm.click();await reduced.page.waitForFunction(()=>document.querySelector('[data-project-film="64th"] video').currentTime>.15);assert.equal(reduced.requests.length,1);await reduced.context.close();
  console.log('projects: 14 named sections, York group, equal sizing, hover, touch and reduced-motion playback passed');
}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
