import { escapeHtml as e } from './html.mjs';
import { photos, picture, photoUrl } from './photos.mjs';
import { videoCatalog } from './video-catalog.mjs';
import { videoAssets } from './video-assets.mjs';
const attributes=id=>{
  const c=videoCatalog[id],a=videoAssets[id];
  return `data-clip="${id}" data-small="${a[480].url}" data-large="${a[720].url}" data-title="${e(c.title)}" data-description="${e(c.description)}" data-poster="${photoUrl(c.photo)}" data-srcset="${[480,800,1280,1920].map(w=>photoUrl(c.photo,w,'webp')+' '+w+'w').join(', ')}" data-alt="${e(photos[c.photo].alt)}"`;
};
const screen=(id,uid)=>{
  const c=videoCatalog[id];
  return `<div class="motion-screen"><div class="motion-frame">${picture(c.photo,{sizes:'(max-width: 800px) calc(100vw - 42px), 940px'})}<video id="${uid}-video" width="1280" height="720" muted playsinline preload="none" aria-label="${e(c.description)}" tabindex="-1"></video></div><div class="motion-controls"><button type="button" class="motion-toggle" aria-controls="${uid}-video" aria-pressed="false"><span class="motion-toggle-icon" aria-hidden="true">▶</span><span class="motion-toggle-label">Play video</span></button><span class="motion-time" aria-hidden="true">0:00 / 0:06</span><span class="motion-silent">Silent video</span><button type="button" class="motion-replay" aria-controls="${uid}-video" aria-label="Replay video">↺</button><progress class="motion-progress" max="6.042" value="0" aria-label="Video progress" aria-hidden="true"></progress></div><p class="motion-status" role="status" aria-live="polite"></p><a class="motion-fallback" href="${videoAssets[id][480].url}" hidden>Open this video directly ↗</a></div>`;
};
export function motionFigure(key,{id='film-'+key}={}) {
  const c=videoCatalog[key];
  return `<figure class="motion-inline motion-experience" id="${id}" data-motion-player ${attributes(key)}>${screen(key,id)}<figcaption><span class="motion-caption-title">${e(c.title)}</span><span>Six seconds · A closer look</span></figcaption><noscript><p><a href="${videoAssets[key][480].url}">Watch this short video ↗</a></p></noscript></figure>`;
}
