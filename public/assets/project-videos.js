const finePointer=matchMedia('(hover: hover) and (pointer: fine)');
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
const films=[...document.querySelectorAll('[data-project-film]')];
let active;
let focusFrame;

const sourceFor=card => (innerWidth<700?card.dataset.small:card.dataset.large);
const allowsAutomaticPlayback=()=>!reducedMotion.matches&&!connection?.saveData&&!/2g|3g/.test(connection?.effectiveType||'');
const playsInView=()=>!finePointer.matches&&allowsAutomaticPlayback();
const idleLabel=()=>finePointer.matches?'Hover to play':playsInView()?'Plays in view':'Tap to play';
const setLabel=(card,text,icon='▶')=>{
  card.querySelector('.project-film-action-label').textContent=text;
  card.querySelector('.project-film-icon').textContent=icon;
};
const unload=card=>{
  if(!card)return;
  const video=card.querySelector('video');
  video.pause();video.removeAttribute('src');video.load();
  card.classList.remove('is-playing');card.setAttribute('aria-label',card.getAttribute('aria-label').replace(/^Pause /,'Play '));
  setLabel(card,idleLabel());
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
  setLabel(card,idleLabel());
  card.addEventListener('click',event=>{event.preventDefault();card.classList.contains('is-playing')?unload(card):play(card);});
  card.addEventListener('pointerenter',()=>{
    if(finePointer.matches&&allowsAutomaticPlayback())play(card);
  });
  card.addEventListener('pointerleave',()=>{if(finePointer.matches)unload(card);});
  root.querySelector('video').addEventListener('error',()=>{unload(card);setLabel(card,'Video unavailable');});
}

const focusVisibleVideo=()=>{
  focusFrame=undefined;
  if(!playsInView())return;
  const viewportCenter=innerHeight/2;
  const candidates=films.map(root=>{
    const card=root.querySelector('.project-film-media');
    const rect=card.getBoundingClientRect();
    const visible=Math.max(0,Math.min(rect.bottom,innerHeight)-Math.max(rect.top,0));
    return {card,ratio:visible/Math.min(rect.height,innerHeight),distance:Math.abs((rect.top+rect.bottom)/2-viewportCenter)};
  }).filter(item=>item.ratio>=.58).sort((a,b)=>a.distance-b.distance);
  const focused=candidates[0]?.card;
  if(focused&&focused!==active)play(focused);
  else if(!focused&&active)unload(active);
};
const scheduleFocus=()=>{
  if(!focusFrame)focusFrame=requestAnimationFrame(focusVisibleVideo);
};
const observer=new IntersectionObserver(scheduleFocus,{threshold:[0,.25,.58,.75,1]});
films.forEach(root=>observer.observe(root.querySelector('.project-film-media')));
addEventListener('scroll',scheduleFocus,{passive:true});
addEventListener('resize',scheduleFocus,{passive:true});
finePointer.addEventListener?.('change',()=>{films.forEach(root=>setLabel(root.querySelector('.project-film-media'),idleLabel()));scheduleFocus();});
reducedMotion.addEventListener?.('change',()=>{if(!allowsAutomaticPlayback())unload(active);films.forEach(root=>setLabel(root.querySelector('.project-film-media'),idleLabel()));scheduleFocus();});

const initProjectScale=()=>{
  const {gsap,ScrollTrigger,Flip}=window;
  const scopes=[...document.querySelectorAll('[data-project-scale]')];
  if(!gsap||!ScrollTrigger||!Flip||!scopes.length||reducedMotion.matches)return;
  gsap.registerPlugin(ScrollTrigger,Flip);
  document.documentElement.classList.add('has-project-flip');
  let timelines=[];
  const attachedCopy=scope=>{
    const section=scope.closest('.project-film-section');
    const copy=[scope.querySelector(':scope > figcaption')];
    if(section?.querySelector('[data-project-scale]')===scope)copy.unshift(section.querySelector('.project-film-heading'));
    return copy.filter(Boolean);
  };
  const build=()=>{
    timelines.forEach(timeline=>{timeline.scrollTrigger?.kill();timeline.kill();});
    timelines=[];
    scopes.forEach(scope=>{
      gsap.set(scope.querySelector('[data-flip-element="target"]'),{clearProps:'transform,width,height'});
      gsap.set(attachedCopy(scope),{clearProps:'transform'});
    });
    scopes.forEach(scope=>{
      const wrappers=[...scope.querySelectorAll('[data-flip-element="wrapper"]')];
      const target=scope.querySelector('[data-flip-element="target"]');
      if(wrappers.length<2||!target)return;
      const first=wrappers[0],last=wrappers.at(-1);
      const firstRect=first.getBoundingClientRect(),lastRect=last.getBoundingClientRect();
      const distance=Math.max(1,lastRect.top+scrollY+last.offsetHeight/2-(firstRect.top+scrollY+first.offsetHeight/2));
      const copyDistance=lastRect.top-firstRect.top;
      const timeline=gsap.timeline({scrollTrigger:{trigger:first,start:'center center',endTrigger:last,end:'center 60%',scrub:.25,invalidateOnRefresh:true}});
      timeline.add(Flip.fit(target,last,{duration:distance,ease:'none'}));
      const copy=attachedCopy(scope);
      if(copy.length)timeline.to(copy,{y:copyDistance,duration:distance,ease:'none'},0);
      timelines.push(timeline);
    });
    ScrollTrigger.sort();ScrollTrigger.refresh();scheduleFocus();
  };
  requestAnimationFrame(build);
  let resizeTimer;
  addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(build,120);},{passive:true});
};
document.readyState==='complete'?initProjectScale():addEventListener('load',initProjectScale,{once:true});
