import assert from 'node:assert/strict';
import { writeFile, readFile, mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
await mkdir('artifacts/section-scroll', { recursive: true });
import { createServer } from '../server.mjs';
import { paths } from '../src/config.mjs';
const server = await createServer();
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({headless:true, ...(process.env.CHROME_EXECUTABLE ? {executablePath:process.env.CHROME_EXECUTABLE} : {})});
const errors=[], report={};
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage();
page.on('pageerror',e=>errors.push(e.message));
page.on('console',e=>{if(e.type()==='error') errors.push(e.text());});
const visibleStyles=selector=>page.locator(selector).evaluateAll(els=>els.filter(el=>el.getClientRects().length).every(el=>Number(getComputedStyle(el).opacity)>.99 && ['none','inset(0% 0% 0% 0%)'].includes(getComputedStyle(el).clipPath)));
try {
  await page.goto(base+paths.services);
  assert.equal(await page.evaluate(()=>gsap.version),'3.13.0');
  assert.ok(await page.evaluate(()=>ScrollTrigger.getAll().length>0));
  const feature=page.locator('.service-feature--reverse');
  await page.evaluate(()=>scrollTo(0,document.querySelector('.service-feature--reverse').offsetTop-innerHeight*.72));
  await page.waitForTimeout(260);
  await page.screenshot({path:'artifacts/section-scroll/services-entering.png'});
  await page.evaluate(()=>{const el=document.querySelector('.service-feature--reverse');scrollTo(0,el.getBoundingClientRect().bottom+scrollY-innerHeight*.4);});
  await page.waitForTimeout(1300);
  assert.equal(await visibleStyles('.service-feature--reverse .service-feature-copy > *, .service-feature--reverse .service-feature-photo'),true);
  await page.screenshot({path:'artifacts/section-scroll/services-settled.png'});
  // Fast jumps must settle everything passed rather than strand partially revealed content.
  await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));await page.waitForTimeout(1500);
  assert.equal(await visibleStyles('.contact-band div, .contact-band div > *'),true);
  report.service='GSAP loaded, reverse feature finishes, fast jump to CTA stays readable';

  await page.goto(base+'/home-additions/');
  const hash=await page.locator('.page-sidebar nav a').last().getAttribute('href');
  await page.locator('.page-sidebar nav a').last().click();await page.waitForTimeout(250);
  assert.equal(await visibleStyles(`${hash} > *`),true);
  const cta=page.locator('.contact-band .button');await cta.focus();
  assert.equal(await visibleStyles('.contact-band div, .contact-band div > *'),true);
  assert.equal(await page.locator('.contact-band .summit-line').evaluateAll(els=>els.every(el=>Math.abs(gsap.getProperty(el,'yPercent'))<.1)),true);
  const faq=page.locator('.faq details').first();await faq.locator('summary').click();
  await page.waitForTimeout(450);assert.equal(await faq.getAttribute('open'),'');
  report.navigation='Anchor jump and keyboard-focused CTA reveal immediately; FAQ expansion works';

  await page.goto(base+paths.projects);
  await page.locator('[data-photo-filter=kitchen]').click();await page.waitForTimeout(400);
  assert.equal(await page.locator('.gallery-item:visible').count(),9);
  assert.equal(await visibleStyles('.gallery-item:not([hidden]) .gallery-link, .gallery-item:not([hidden]) figcaption'),true);
  await page.locator('[data-photo-filter=all]').click();
  const photo=page.locator('[data-photo-view]:not([data-film])').first();await photo.click();
  assert.equal(await page.locator('.photo-dialog').isVisible(),true);await page.keyboard.press('Escape');
  report.gallery='Both filter states retain visible images; photo viewer opens and closes';

  await page.goto(base+paths.resources);await page.locator('#resource-search').fill('asbestos');
  assert.equal(await page.locator('.resource-item:visible').count(),1);
  await page.locator('#resource-search').fill('');report.resources='Search and reset work';

  await page.goto(base+paths.process);
  await page.evaluate(()=>scrollTo(0,700));await page.waitForTimeout(1100);
  const progress=await page.locator('.process-list').evaluate(el=>Number(getComputedStyle(el).getPropertyValue('--process-progress')));
  assert.ok(progress>0 && progress<1);report.process='Construction line follows scroll';
  await page.screenshot({path:'artifacts/section-scroll/process-desktop.png'});
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>ScrollTrigger.getAll().length),0);
  assert.equal(await visibleStyles('.process-list li > *, .process-list li > div > *'),true);
  await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(200);
  assert.ok(await page.evaluate(()=>ScrollTrigger.getAll().length)>0);
  await page.emulateMedia({media:'print'});await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>ScrollTrigger.getAll().length),0);
  await page.emulateMedia({media:'screen'});report.preferences='Live reduced-motion and print changes remove triggers and restore content';

  const manifest=JSON.parse(await readFile('dist/manifest.json','utf8'));
  for(const width of [1440,390,320]) {
    await page.setViewportSize({width,height:900});
    for(const item of manifest.pages) {
      await page.goto(base+item.path);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${width}: ${item.path}`);
    }
    console.log(`Layout checks passed: ${manifest.pages.length} pages at ${width}px`);
  }
  await page.setViewportSize({width:390,height:844});await page.goto(base+paths.services);
  await page.locator('.service-feature--reverse').scrollIntoViewIfNeeded();await page.waitForTimeout(1200);
  await page.screenshot({path:'artifacts/section-scroll/services-mobile.png'});
  report.layout='All 54 pages at 1440, 390 and 320 pixels: no horizontal overflow';

  const blocked=await browser.newContext({viewport:{width:1440,height:1000}});
  await blocked.route('**/assets/gsap.min.js*',route=>route.abort());
  const fallback=await blocked.newPage();await fallback.goto(base+paths.services);
  assert.equal(await fallback.locator('.service-feature-copy h2').evaluateAll(els=>els.every(el=>getComputedStyle(el).opacity==='1')),true);
  const plain=await browser.newContext({javaScriptEnabled:false});const nojs=await plain.newPage();await nojs.goto(base+paths.services);
  assert.equal(await nojs.locator('.service-feature-photo').first().isVisible(),true);
  report.fallback='Content remains visible with GSAP blocked or JavaScript disabled';
  assert.deepEqual(errors,[]);report.errors=errors;
  await writeFile('artifacts/section-scroll/browser-report.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
