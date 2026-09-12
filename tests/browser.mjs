// Optional browser checks: PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/browser.mjs
import { mkdir, readFile, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { createServer } from '../server.mjs';
import { readInquiries } from '../src/inquiries.mjs';
const { chromium }=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const dir=await mkdtemp(path.join(os.tmpdir(),'summit-browser-'));
const server=await createServer({inquiryDirectory:dir,rateLimit:30});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const manifest=JSON.parse(await readFile('dist/manifest.json','utf8'));
const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});
const errors=[];
await mkdir('artifacts',{recursive:true});
try {
  const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  for(const p of manifest.pages) {
    const r=await page.goto(base+p.path);assert.equal(r.status(),200,p.path);
    await page.locator('img[loading=lazy]').evaluateAll(imgs=>imgs.forEach(img=>img.loading='eager'));
    const broken=await page.evaluate(async()=>{await Promise.all([...document.images].map(img=>img.decode().catch(()=>{})));return [...document.images].filter(img=>img.getAttribute('src')&&!img.naturalWidth).map(img=>img.currentSrc||img.src);});
    assert.deepEqual(broken,[],'Broken images: '+p.path);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false,'Desktop overflow: '+p.path);
  }
  await page.goto(base);await page.screenshot({path:'artifacts/home-desktop.png',fullPage:true});
  await page.goto(base+'/home-additions/');await page.screenshot({path:'artifacts/service-desktop.png',fullPage:true});
  await page.goto(base+'/blog/');await page.locator('#resource-search').fill('asbestos');
  assert.equal(await page.locator('.resource-item:visible').count(),1);await page.locator('#resource-search').fill('not a match qzz');assert.equal(await page.locator('#no-resources').isVisible(),true);
  await page.locator('#resource-search').fill('');await page.locator('#resource-topic').selectOption('additions');assert.ok(await page.locator('.resource-item:visible').count()>=5);
  const projects=manifest.pages.find(p=>p.title.startsWith('Project Gallery')).path;
  await page.goto(base+projects);await page.locator('[data-photo-filter=kitchen]').click();
  assert.equal(await page.locator('.gallery-item:visible').count(),9);
  const firstPhoto=page.locator('.gallery-item:visible [data-photo-view]:not([data-film])').first();
  await firstPhoto.click();assert.equal(await page.locator('.photo-dialog').isVisible(),true);
  await page.locator('.photo-dialog img').evaluate(img=>img.decode());
  const firstCaption=await page.locator('#photo-dialog-caption').textContent();
  await page.keyboard.press('ArrowRight');assert.notEqual(await page.locator('#photo-dialog-caption').textContent(),firstCaption);
  await page.keyboard.press('Escape');assert.equal(await page.locator('.photo-dialog').isVisible(),false);
  assert.equal(await firstPhoto.evaluate(el=>document.activeElement===el),true);
  const photoResponse=await page.request.get(base+await firstPhoto.getAttribute('href'));assert.equal(photoResponse.status(),200);assert.equal(photoResponse.headers()['content-type'],'image/webp');
  for(const width of [390,320]) {
    await page.setViewportSize({width,height:844});
    for(const p of manifest.pages){await page.goto(base+p.path);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${width}px overflow: ${p.path}`);}
  }
  await page.setViewportSize({width:390,height:844});await page.goto(base);await page.screenshot({path:'artifacts/home-mobile.png',fullPage:true});
  assert.equal(await page.locator('.home-menu nav').isVisible(),false);await page.locator('.home-menu summary').click();assert.equal(await page.locator('.home-menu nav').isVisible(),true);await page.keyboard.press('Escape');assert.equal(await page.locator('.home-menu nav').isVisible(),false);
  const contact=manifest.pages.find(p=>p.path.includes('contact-contractor')).path;
  await page.goto(base+contact+'?service=additions&city=arvada');
  assert.equal(await page.locator('#service').inputValue(),'additions');
  await page.locator('#name').fill('Browser Test');await page.locator('#email').fill('browser@example.com');await page.locator('#message').fill('Browser test inquiry for a planned home addition.');
  await page.screenshot({path:'artifacts/contact-mobile.png',fullPage:true});
  await page.locator('button[type=submit]').click();await page.waitForURL('**/thank-you/');await server.drain();assert.equal((await readInquiries(dir)).length,1);
  await page.goto(base+'/service-areas/morrison-co/');await page.screenshot({path:'artifacts/city-mobile.png',fullPage:true});
  const plain=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});const nojs=await plain.newPage();
  await nojs.goto(base+contact);assert.equal(await nojs.locator('.navigation nav').isVisible(),true);
  await nojs.locator('#name').fill('No JavaScript Test');await nojs.locator('#email').fill('nojs@example.com');await nojs.locator('#city').selectOption('golden');await nojs.locator('#service').selectOption('bathroom');await nojs.locator('#message').fill('No JavaScript inquiry about a bathroom remodel.');await nojs.locator('button[type=submit]').click();await nojs.waitForURL('**/thank-you/');await server.drain();assert.equal((await readInquiries(dir)).length,2);
  assert.deepEqual(errors,[]);
  await mkdir('artifacts',{recursive:true});await (await import('node:fs/promises')).writeFile('artifacts/browser-report.json',JSON.stringify({pages:manifest.pages.length,widths:[1440,390,320],consoleErrors:errors,formWithJS:'passed',formWithoutJS:'passed',filter:'passed',menu:'passed',allImages:'passed',photoGallery:'passed'},null,2));
  console.log(`Browser checks passed: ${manifest.pages.length} pages at desktop, 390px, and 320px; all photos load; working gallery, filters/menu; forms with and without JavaScript.`);
} finally {await browser.close();await server.drain();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});}
