import { escapeHtml as e } from './html.mjs';
import { projectVideoGroups } from './project-video-catalog.mjs';
import { projectVideoAssets } from './project-video-assets.mjs';

const film = (clip,showTitle) => {
  const asset=projectVideoAssets[clip.id];
  if(!asset)throw new Error(`Missing prepared project video: ${clip.id}`);
  return `<figure class="project-film-card" data-project-film="${e(clip.id)}">
    ${showTitle?`<figcaption><h3>${e(clip.title)}</h3></figcaption>`:''}
    <a class="project-film-media" href="${asset[720].url}" data-small="${asset[480].url}" data-large="${asset[720].url}" aria-label="Play ${e(clip.title)} project video">
      <picture class="project-film-poster"><img src="${asset.poster.url}" width="1280" height="720" loading="lazy" decoding="async" alt="Still frame from the ${e(clip.title)} project video"></picture>
      <video width="1280" height="720" muted playsinline loop preload="none" aria-hidden="true"></video>
      <span class="project-film-action" aria-hidden="true"><span class="project-film-icon">▶</span><span class="project-film-action-label">Hover to play</span></span>
    </a>
  </figure>`;
};

export function projectVideosMarkup() {
  return `<nav class="project-index" aria-label="Projects on this page"><p>Explore by project</p><div>${projectVideoGroups.map(group=>`<a href="#project-${group.id}">${e(group.label)}</a>`).join('')}</div></nav>
  <div class="project-film-list">${projectVideoGroups.map(group=>`<section class="project-film-section" id="project-${group.id}" aria-labelledby="project-${group.id}-title">
    <header class="project-film-heading"><p class="eyebrow">Featured project</p><h2 id="project-${group.id}-title">${e(group.title)}</h2><p>${e(group.support)}</p></header>
    <div class="project-film-stack">${group.clips.map(clip=>film(clip,group.clips.length>1)).join('')}</div>
  </section>`).join('')}</div>`;
}
