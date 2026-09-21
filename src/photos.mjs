import { escapeHtml as e, sections } from './html.mjs';
import { videoCatalog } from './video-catalog.mjs';
import { videoAssets } from './video-assets.mjs';

// The supplied filenames are retained for provenance, not used to assert a project location.
export const photos = Object.fromEntries([
  ['framing','home-addition-framing-project','construction','Exposed timber framing above an existing brick home','The structure takes shape'],
  ['framingWide','two-story-home-addition-construction','construction','Two-story home addition under construction beside mature trees','Making room to grow'],
  ['framingMaterials','home-addition-framing-and-materials','construction','Addition framing, sheathing, and stacked construction materials','Connecting new space to an existing home'],
  ['backyard','backyard-home-addition-construction','construction','Backyard view of a home addition during construction','A different view of the building process'],
  ['attachedLiving','home-addition-exterior-framing','construction','Attached living space under construction beside an existing brick home','New living space taking shape alongside the existing home'],
  ['windowWork','exterior-window-opening-renovation','construction','Work in progress around a large exterior window opening','Opening up an existing home'],
  ['windowDone','replacement-window-home-remodel','construction','Large replacement window in a textured exterior wall','Window replacement'],
  ['whiteKitchen','white-cabinet-kitchen-remodel','kitchen','White kitchen cabinetry, full-height storage, and pale wood flooring','White kitchen remodel'],
  ['island','white-kitchen-island-renovation','kitchen','White kitchen island with a stone surface and brass-toned faucet','A place to gather'],
  ['peninsula','modern-kitchen-peninsula-remodel','kitchen','Long kitchen peninsula beneath a skylight','Space for everyday living'],
  ['quartz','quartz-countertop-kitchen-renovation','kitchen','Pale stone countertops meeting white cabinetry in a renovated kitchen','The surfaces you use every day'],
  ['cooktop','cooktop-white-cabinet-kitchen-renovation','kitchen','Cooktop and range hood surrounded by white cabinetry','Cooking, storage, and light'],
  ['lighting','under-cabinet-lighting-kitchen-remodel','kitchen','Illuminated backsplash beneath white kitchen cabinets','Light where it matters'],
  ['appliances','stainless-appliance-white-kitchen-remodel','kitchen','Stainless refrigerator and wall ovens fitted into white cabinetry','Appliances planned into the layout'],
  ['navyKitchen','navy-blue-kitchen-remodel','kitchen','Navy base cabinets and white upper cabinets with a dark tile backsplash','A little more character'],
  ['navySink','navy-cabinet-kitchen-sink-remodel','kitchen','Kitchen sink and gold-toned faucet above navy blue cabinetry','Color in the details'],
  ['range','gas-range-kitchen-remodel-detail','kitchen','Close view of a gas range and dark tiled kitchen backsplash','Details at the heart of the kitchen'],
  ['sink','open-concept-kitchen-island-sink-remodel','kitchen','Kitchen island sink looking across an open white kitchen','A more connected kitchen'],
  ['bathtub','freestanding-tub-bathroom-renovation','bathroom','Freestanding white bathtub beside a window and patterned tile wall','Room to slow down'],
  ['tubShower','freestanding-tub-walk-in-shower-remodel','bathroom','Freestanding bathtub beside a glass-enclosed shower','A considered bathroom layout'],
  ['tubDetail','freestanding-tub-faucet-detail','bathroom','Brass-toned faucet beside the curved edge of a freestanding tub','The finishing touch'],
  ['patternedTile','patterned-tile-freestanding-tub-remodel','bathroom','Patterned shower tile beside a freestanding bathtub and window','Pattern, texture, and natural light'],
  ['tealVanity','teal-double-vanity-bathroom-remodel','bathroom','Teal double vanity with oval mirrors and wall sconces','Storage with personality'],
  ['tealRoom','teal-vanity-luxury-bathroom-renovation','bathroom','Teal vanity, glass shower, and freestanding bathtub in a light bathroom','A room designed around daily routines'],
  ['marbleShower','marble-walk-in-shower-remodel','bathroom','Shower walls with veined white tile and a built-in niche','Consider every surface'],
  ['tubTile','marble-tub-shower-renovation','bathroom','Tiled bathtub surround with a niche and horizontal support bar','The details behind daily comfort'],
  ['whiteVanity','white-vanity-bathroom-remodel','bathroom','White bathroom vanity beneath a framed mirror','Simple, useful storage'],
  ['floor','bathroom-flooring-and-vanity-remodel','bathroom','Pale wood-look bathroom flooring alongside a white vanity','Room to move through the space']
].map(([id,file,group,alt,caption])=>[id,{id,file:'denver-'+file,group,alt,caption}]));

export const servicePhotos={
  additions:['framing','attachedLiving','backyard'],
  remodeling:['island','windowDone','whiteKitchen'],
  kitchen:['navyKitchen','quartz','lighting'],
  bathroom:['tealRoom','patternedTile','tubDetail'],
  contractor:['framingMaterials','windowWork','backyard'],
  aging:['tubTile','floor','whiteVanity']
};
const guidePhotos={
  'planning-addition':'framing','addition-cost':'framingMaterials','addition-timeline':'backyard','build-up-out':'framingWide',
  'addition-vs-moving':'windowDone','whole-home-plan':'island','whole-home-cost':'whiteKitchen','living-through-remodel':'windowWork',
  'kitchen-cost':'quartz','bathroom-cost':'tealRoom','hiring-contractor':'framing','aging-checklist':'tubTile',
  'asbestos':'windowWork','soils':'backyard','radon':'framingWide','older-homes':'windowDone','jeffco':'framingMaterials',
  'kitchen-routines':'navySink','remodel-priorities':'peninsula','bathroom-users':'whiteVanity','welcome':'island'
};
export const guidePhoto = g => guidePhotos[g.id]||servicePhotos[g.service]?.[0]||'island';
export const photoUrl=(id,width=1280,format='jpg')=>`/assets/${photos[id].file}-${width}.${format}`;
export function picture(id,{sizes='(max-width: 800px) calc(100vw - 42px), 760px',decorative=false}={}) {
  const p=photos[id];if(!p)throw new Error('Unknown photo '+id);
  return `<picture class="photo"><source type="image/webp" srcset="${[480,800,1280,1920].map(w=>`${photoUrl(id,w,'webp')} ${w}w`).join(', ')}" sizes="${e(sizes)}"><img src="${photoUrl(id)}" width="1280" height="720" loading="lazy" decoding="async" alt="${decorative?'':e(p.alt)}"></picture>`;
}
export function photoFigure(id,{className='',caption=photos[id].caption,sizes}={}) {
  return `<figure class="photo-figure ${e(className)}">${picture(id,{sizes})}${caption?`<figcaption>${e(caption)}</figcaption>`:''}</figure>`;
}
export function photoSections(items,id) {
  return items.map((item,i)=>sections([item])+(i===0?photoFigure(id,{className:'article-photo'}):'')).join('');
}
export function detailPair(service) {
  const ids=servicePhotos[service];
  return `<div class="detail-pair">${ids.slice(1).map(id=>photoFigure(id,{sizes:'(max-width: 600px) calc(100vw - 42px), (max-width: 800px) 45vw, 360px'})).join('')}</div>`;
}
export function quietPhotos() {
  return `<div class="container"><div class="quiet-photos" aria-hidden="true">${picture('quartz',{decorative:true})}${picture('tubDetail',{decorative:true})}${picture('framing',{decorative:true})}</div></div>`;
}
// These photos appear only in the lower still-photo section on the Projects page.
export const projectDetailPhotos=['whiteKitchen','tealVanity','framingWide','navySink','tubShower','windowDone'];
export function galleryMarkup({curated=false}={}) {
  const groups=[['all','All views'],['kitchen','Kitchens'],['bathroom','Bathrooms'],['construction','Construction']];
  // Wide positions are films; three smaller films sit among the photo pairs.
  const full=['island','tealRoom','quartz','tubDetail','backyard','attachedLiving','peninsula','floor','framing','bathtub','lighting','tubTile','appliances','framingMaterials','marbleShower','navyKitchen','range','cooktop','patternedTile','whiteVanity','windowWork','sink'];
  const ordered=curated?['island','tealRoom','navyKitchen','patternedTile','quartz','tealVanity','tubDetail','attachedLiving']:full;
  const filmByPhoto=Object.fromEntries(Object.entries(videoCatalog).map(([key,c])=>[c.photo,key]));
  return `${curated?'':`<div class="photo-filters" role="group" aria-label="Filter the gallery">${groups.map(([value,label])=>`<button type="button" data-photo-filter="${value}" aria-pressed="${value==='all'}">${label}</button>`).join('')}</div>`}<p class="photo-count small" aria-live="polite">${ordered.length} views · Select a photo or video for a closer look. <span class="film-hover-hint">Hover over a video to play.</span></p><div class="photo-gallery${curated?' photo-gallery--curated':''}">${ordered.map((id,i)=>{
    const key=filmByPhoto[id],film=key?videoAssets[key]:null;
    const large=i%7===0;
    const filmAttrs=film?` data-film="${key}" data-small="${film[480].url}" data-large="${film[720].url}"`:'';
    return `<figure class="gallery-item${film?' gallery-item--film':''}" data-photo-group="${photos[id].group}"><a class="gallery-link" href="${film?film[480].url:photoUrl(id,1920,'webp')}" data-photo-view${filmAttrs} data-caption="${e(photos[id].caption)}" data-alt="${e(photos[id].alt)}">${picture(id,{sizes:large?'(max-width: 600px) calc(100vw - 42px), calc(100vw - 96px)':'(max-width: 600px) calc(100vw - 42px), (max-width: 1000px) 46vw, 560px'})}${film?'<video class="gallery-preview-video" width="1280" height="720" muted playsinline preload="none" aria-hidden="true" tabindex="-1"></video><span class="film-badge" aria-hidden="true">Video <span>0:06</span></span>':''}<span class="photo-expand" aria-hidden="true">${film?'▶':'↗'}</span></a><figcaption>${e(photos[id].caption)}${film?'<span class="film-caption-kind">Video</span>':''}</figcaption></figure>`;
  }).join('')}</div><dialog class="photo-dialog" aria-labelledby="photo-dialog-caption"><button type="button" class="photo-close" aria-label="Close gallery viewer">Close <span aria-hidden="true">×</span></button><div class="photo-dialog-stage"><img alt="" width="1920" height="1080"><video class="gallery-full-film" width="1280" height="720" controls muted playsinline preload="none" hidden></video></div><div class="photo-dialog-bottom"><button type="button" class="photo-previous" aria-label="Previous view">←</button><p id="photo-dialog-caption" aria-live="polite"></p><button type="button" class="photo-next" aria-label="Next view">→</button></div></dialog>`;
}
