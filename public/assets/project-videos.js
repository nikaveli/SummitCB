const finePointer=matchMedia('(hover: hover) and (pointer: fine)');
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
const films=[...document.querySelectorAll('[data-project-film]')];
let active;

const sourceFor=card => (innerWidth<700?card.dataset.small:card.dataset.large);
const setLabel=(card,text,icon='▶')=>{
  card.querySelector('.project-film-action-label').textContent=text;
  card.querySelector('.project-film-icon').textContent=icon;
};
const unload=card=>{
  if(!card)return;
  const video=card.querySelector('video');
  video.pause();video.removeAttribute('src');video.load();
  card.classList.remove('is-playing');card.setAttribute('aria-label',card.getAttribute('aria-label').replace(/^Pause /,'Play '));
  setLabel(card,finePointer.matches?'Hover to play':'Tap to play');
  if(active===card)active=undefined;
};
const play=async card=>{
  if(active&&active!==card)unload(active);
  const video=card.querySelector('video');
  if(!video.getAttribute('src')){video.src=sourceFor(card);video.load();}
  active=card;card.classList.add('is-playing');card.setAttribute('aria-label',card.getAttribute('aria-label').replace(/^Play /,'Pause '));setLabel(card,'Pause','Ⅱ');
  try{await video.play();}catch{unload(card);}
};

for(const root of films){
  const card=root.querySelector('.project-film-media');
  setLabel(card,finePointer.matches?'Hover to play':'Tap to play');
  card.addEventListener('click',event=>{event.preventDefault();card.classList.contains('is-playing')?unload(card):play(card);});
  card.addEventListener('pointerenter',()=>{
    if(finePointer.matches&&!reducedMotion.matches&&!connection?.saveData&&!/2g|3g/.test(connection?.effectiveType||''))play(card);
  });
  card.addEventListener('pointerleave',()=>{if(finePointer.matches)unload(card);});
  root.querySelector('video').addEventListener('error',()=>{unload(card);setLabel(card,'Video unavailable');});
}

const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
  if(!entry.isIntersecting&&active===entry.target.querySelector('.project-film-media'))unload(active);
}),{rootMargin:'180px'});
films.forEach(film=>observer.observe(film));
