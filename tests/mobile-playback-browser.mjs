import assert from 'node:assert/strict';
const {webkit,chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const BASE=process.env.TEST_BASE_URL||'http://127.0.0.1:3000';
for(const name of ['chromium','webkit']) {
 const browser=await (name==='webkit'?webkit.launch({headless:true,...(process.env.WEBKIT_EXECUTABLE?{executablePath:process.env.WEBKIT_EXECUTABLE}:{})}):chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})}));
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/assets/scroll-hero/*.mp4',async route=>{await new Promise(r=>setTimeout(r,750));await route.continue();});
 await page.goto(BASE+'/',{waitUntil:'domcontentloaded'});await page.touchscreen.tap(200,350);
 for(const [y,index] of [[800,0],[2500,1],[4000,2],[500,0]]){
  await page.evaluate(y=>scrollTo(0,y),y);
  await page.waitForFunction(index=>{const v=document.querySelectorAll('.sw-scene')[index]?.querySelector('video');return v?.currentTime>.3&&v.readyState>=2;},index);
  assert.ok(Math.abs(await page.locator('.sw-stage').evaluate(e=>e.getBoundingClientRect().top))<2);
 }
 assert.ok(await page.locator('.sw-scene video').first().evaluate(v=>v.currentSrc.includes('light-m.mp4')));
 await page.goto(BASE+'/our-projects/');
 const film=page.locator('[data-film=island]');await film.scrollIntoViewIfNeeded();await page.waitForTimeout(400);
 assert.equal(await film.locator('video').getAttribute('src'),null);
 await film.tap();await page.waitForFunction(()=>document.querySelector('[data-film=island] video').currentTime>.2);
 assert.equal(await page.locator('dialog[open]').count(),0);
 assert.ok(await film.locator('video').evaluate(v=>v.playsInline&&!v.webkitDisplayingFullscreen));
 const controls=film.locator('..').locator('.gallery-film-controls');await controls.locator('.gallery-film-toggle').tap();assert.ok(await film.locator('video').evaluate(v=>v.paused));
 const t=await film.locator('video').evaluate(v=>v.currentTime);await controls.locator('.gallery-film-toggle').tap();await page.waitForFunction(t=>document.querySelector('[data-film=island] video').currentTime>t+.2,t);
 await controls.locator('.gallery-film-replay').tap();await page.waitForTimeout(200);
 assert.equal(await controls.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(41, 37, 34)');
 if(name==='chromium')await page.screenshot({path:'/tmp/summit-mobile-inline.png'});
 await page.locator('[data-photo-filter=bathroom]').tap();assert.ok(await film.locator('video').evaluate(v=>v.paused));
 await page.locator('[data-photo-filter=all]').tap();
 const photo=page.locator('.gallery-link:not([data-film])').first();await photo.tap();assert.equal(await page.locator('dialog[open]').count(),1);
 for(let i=0;i<3;i++){await page.locator('.photo-next').tap();assert.ok(await page.locator('.gallery-full-film').evaluate(v=>v.hidden));}
 assert.deepEqual(errors,[]);console.log(name, 'PASS: delayed mobile hero load, all chapters, reverse scroll, inline play/pause/replay, filter pause, photo-only viewer, warm controls');
 const reduce=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});await reduce.goto(BASE+'/');await reduce.evaluate(()=>scrollTo(0,2500));await reduce.waitForTimeout(300);assert.equal(await reduce.locator('.sw-scene video').count(),0);console.log(name,'PASS reduced motion');
 await browser.close();
}
