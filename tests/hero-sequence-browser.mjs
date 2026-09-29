import assert from 'node:assert/strict';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:3000';

try {
  for(const [name,width,height,dpr] of [['desktop',1440,900,2],['phone',390,844,3],['tablet',820,1180,2]]){
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr,isMobile:name!=='desktop',hasTouch:name!=='desktop'});
    const page=await context.newPage();
    const errors=[];const requests=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>requests.push(request.url()));
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.querySelector('#home-world')?.dataset.sequenceFrame==='0');
    const layout=await page.evaluate(()=>{
      const wrap=document.querySelector('#home-world');
      const sticky=wrap.querySelector('.image-sequence__sticky');
      const trigger=ScrollTrigger.getById('summit-hero-sequence');
      const canvas=wrap.querySelector('canvas');
      return {height:wrap.offsetHeight,viewport:sticky.offsetHeight,end:trigger.end,frames:Number(canvas.dataset.frames)};
    });
    assert.equal(layout.frames,137);
    assert.ok(Math.abs(layout.end-(layout.height-layout.viewport))<=2,'sticky release must match the animation endpoint');
    assert.equal(await page.locator('#home-world video').count(),0);
    assert.ok(requests.some(url=>url.includes('/hero-sequence-v5/')));
    assert.ok(!requests.some(url=>url.includes('/hero-sequence-v4/')||url.endsWith('.mp4')));

    for(const fraction of [.2,.5,.85,1,.5,0]){
      const expected=Math.round(fraction*136);
      await page.evaluate(({fraction,end})=>scrollTo({top:fraction*end,behavior:'instant'}),{fraction,end:layout.end});
      await page.waitForFunction(frame=>Math.abs(Number(document.querySelector('#home-world').dataset.sequenceFrame)-frame)<=1,expected,{timeout:15000});
      assert.ok(Number(await page.locator('#home-world').getAttribute('data-sequence-cached'))<=(name==='desktop'?16:20));
    }
    assert.deepEqual(errors,[]);

    await page.evaluate(()=>scrollTo({top:ScrollTrigger.getById('summit-hero-sequence').end,behavior:'instant'}));
    await page.waitForFunction(()=>document.querySelector('#home-world').dataset.sequenceFrame==='136');
    assert.equal(await page.locator('.sequence-copy--ending').getAttribute('aria-hidden'),'false');
    await page.locator('.sequence-explore').click();await page.waitForTimeout(200);
    assert.ok(await page.locator('#home-content').evaluate(element=>Math.abs(element.getBoundingClientRect().top)<3));
    assert.equal(await page.evaluate(()=>document.activeElement.id),'home-content');

    await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(100);
    assert.equal(await page.evaluate(()=>!!ScrollTrigger.getById('summit-hero-sequence')),false);
    assert.equal(await page.locator('#home-world').evaluate(element=>element.offsetHeight),height);
    console.log(`${name}: new sequence, forward/reverse scroll, final frame, release and reduced motion passed`);
    await context.close();
  }

  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage();
  await page.route('**/hero-sequence-v5/mobile/frame-068.webp',route=>route.abort());
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.ScrollTrigger?.getById('summit-hero-sequence'));
  await page.evaluate(()=>scrollTo({top:ScrollTrigger.getById('summit-hero-sequence').end,behavior:'instant'}));
  await page.waitForFunction(()=>document.querySelector('#home-world').dataset.sequenceFrame==='136');
  console.log('missing-frame recovery passed');
  await context.close();
} finally {
  await browser.close();
}
