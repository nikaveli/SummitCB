import assert from 'node:assert/strict';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}),
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
const clips = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => {
  if (request.url().includes('/assets/scroll-hero/') && request.url().endsWith('.mp4')) clips.push(request.url());
});

// Simulate a cold edge/browser cache. The still must respond to the first scroll
// rather than appearing frozen while the first scrub clip is in flight.
await page.route('**/assets/scroll-hero/*-scrub.mp4', async route => {
  await new Promise(resolve => setTimeout(resolve, 1800));
  await route.continue();
});

try {
  await page.goto((process.env.TEST_BASE_URL || 'http://127.0.0.1:3000') + '/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => scrollTo(0, 700));
  await page.waitForTimeout(150);
  const cold = await page.locator('.sw-scene').first().evaluate(scene => {
    const still = scene.querySelector('.sw-scene__still');
    const video = scene.querySelector('video');
    return {
      scrollY,
      transform: getComputedStyle(still).transform,
      ready: video?.classList.contains('is-ready') || false,
    };
  });
  assert.ok(cold.scrollY > 500, 'test scroll did not occur');
  assert.notEqual(cold.transform, 'none', 'the still must animate while the scrub clip is loading');
  assert.equal(cold.ready, false, 'the delayed clip should still be loading during the fallback assertion');

  try {
    await page.waitForFunction(() => {
      const video = document.querySelector('.sw-scene video');
      return video?.classList.contains('is-ready') && video.currentTime > 0.2;
    }, null, { timeout: 15000 });
  } catch (error) {
    console.error('Hero media state:', await page.locator('.sw-scene').first().evaluate(scene => {
      const video = scene.querySelector('video');
      return video ? {
        currentSrc: video.currentSrc,
        currentTime: video.currentTime,
        duration: video.duration,
        readyState: video.readyState,
        networkState: video.networkState,
        seeking: video.seeking,
        error: video.error && { code: video.error.code, message: video.error.message },
        classes: video.className,
      } : null;
    }));
    throw error;
  }
  const forward = await page.locator('.sw-scene video').first().evaluate(video => video.currentTime);
  await page.evaluate(() => scrollTo(0, 250));
  await page.waitForFunction(previous => {
    const video = document.querySelector('.sw-scene video');
    return video && !video.seeking && video.currentTime < previous - 0.15;
  }, forward, { timeout: 8000 });
  const reverse = await page.locator('.sw-scene video').first().evaluate(video => video.currentTime);

  assert.ok(clips.some(url => url.includes('light-hq-v3-scrub.mp4')), 'optimized first clip was not requested');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ cold, forward, reverse, firstClip: clips[0] }, null, 2));
} finally {
  await browser.close();
}
