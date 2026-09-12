// A film has no network source until it is deliberately played or eligible for visible desktop playback.
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const desktop=matchMedia('(min-width: 900px) and (hover: hover) and (pointer: fine)');
const connection=navigator.connection;
const economical=()=>connection?.saveData||['slow-2g','2g','3g'].includes(connection?.effectiveType);
const automatic=()=>desktop.matches&&!reduced.matches&&!economical();
const controllers=new Set();
const formatTime=seconds=>'0:'+String(Math.floor(seconds||0)).padStart(2,'0');

for(const root of document.querySelectorAll('[data-motion-player]')) {
  const video=root.querySelector('video');
  const frame=root.querySelector('.motion-frame');
  const toggle=root.querySelector('.motion-toggle');
  const icon=root.querySelector('.motion-toggle-icon');
  const label=root.querySelector('.motion-toggle-label');
  const progress=root.querySelector('progress');
  const time=root.querySelector('.motion-time');
  const status=root.querySelector('.motion-status');
  const fallback=root.querySelector('.motion-fallback');
  let visible=false,attempted=false,manuallyPaused=false,intent=false,sequence=0,cancelScheduled=null;
  video.muted=true;
  const controls=state=>{
    root.dataset.state=state;
    const active=state==='playing'||state==='loading';
    toggle.setAttribute('aria-pressed',String(active));
    label.textContent=state==='ended'?'Replay video':state==='error'?'Try again':active?'Pause video':'Play video';
    icon.textContent=active?'Ⅱ':state==='ended'?'↺':'▶';
  };
  const cancel=()=>{cancelScheduled?.();cancelScheduled=null;};
  const pause=(manual=false)=>{
    sequence++;intent=false;cancel();video.pause();
    if(manual){manuallyPaused=true;attempted=true;}
    if(root.dataset.state!=='ended'&&root.dataset.state!=='error')controls('paused');
    status.textContent='';
  };
  const controller={pause};controllers.add(controller);
  const failure=()=>{
    if(!video.getAttribute('src'))return;
    intent=false;delete root.dataset.hasFrame;controls('error');fallback.hidden=false;
    status.textContent='This video could not load. The photos are still available.';
  };
  const play=async()=>{
    cancel();attempted=true;manuallyPaused=false;intent=true;
    const request=++sequence;
    for(const other of controllers)if(other!==controller)other.pause();
    const url=(!desktop.matches||economical())?root.dataset.small:root.dataset.large;
    fallback.href=url;fallback.hidden=true;status.textContent='Loading video…';controls('loading');
    if(!video.getAttribute('src'))video.src=url;
    else if(video.error)video.load();
    if(video.ended)video.currentTime=0;
    try {await video.play();if(request===sequence&&!intent)video.pause();}
    catch(error){
      if(request!==sequence||error.name==='AbortError')return;
      if(error.name==='NotAllowedError'){intent=false;controls('paused');status.textContent='Select Play video to watch.';}
      else failure();
    }
  };
  toggle.addEventListener('click',()=>intent&&!video.ended?pause(true):play());
  root.querySelector('.motion-replay').addEventListener('click',()=>{if(video.getAttribute('src')&&video.readyState>=1)video.currentTime=0;play();});
  video.addEventListener('playing',()=>{
    if(!intent||document.hidden){pause();return;}
    root.dataset.hasFrame='true';controls('playing');status.textContent='';
  });
  video.addEventListener('timeupdate',()=>{
    const duration=Number.isFinite(video.duration)?video.duration:6.042;
    progress.max=duration;progress.value=video.currentTime;
    time.textContent=`${formatTime(video.currentTime)} / ${formatTime(duration)}`;
  });
  video.addEventListener('ended',()=>{intent=false;controls('ended');});
  video.addEventListener('error',failure);
  root.querySelectorAll('.motion-choice').forEach(button=>button.addEventListener('click',()=>{
    if(button.dataset.clip===root.dataset.clip)return;
    const stayPaused=manuallyPaused;
    pause();video.removeAttribute('src');video.load();delete root.dataset.hasFrame;
    for(const key of ['clip','small','large','title','description','poster','srcset','alt'])root.dataset[key]=button.dataset[key];
    const poster=frame.querySelector('picture');poster.querySelector('source').srcset=button.dataset.srcset;
    const img=poster.querySelector('img');img.src=button.dataset.poster;img.alt=button.dataset.alt;
    video.setAttribute('aria-label',button.dataset.description);
    root.querySelectorAll('.motion-choice').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    root.querySelector('.motion-caption-title').textContent=button.dataset.title;
    root.querySelector('.motion-caption-description').textContent=button.dataset.description;
    progress.value=0;time.textContent='0:00 / 0:06';fallback.href=button.dataset.small;fallback.hidden=true;controls('paused');
    if(automatic()&&!stayPaused&&visible&&!document.hidden)play();
  }));
  if('IntersectionObserver' in window) {
    const observer=new IntersectionObserver(entries=>{
      const entry=entries[0];visible=entry.isIntersecting&&entry.intersectionRatio>=.6;
      if(!visible){pause();return;}
      if(!automatic()||attempted||manuallyPaused||document.hidden)return;
      const start=()=>{cancelScheduled=null;if(visible&&automatic()&&!document.hidden&&!attempted)play();};
      if('requestIdleCallback' in window){const id=requestIdleCallback(start,{timeout:1500});cancelScheduled=()=>cancelIdleCallback(id);}
      else {const id=setTimeout(start,200);cancelScheduled=()=>clearTimeout(id);}
    },{threshold:[0,.25,.6,1]});
    observer.observe(frame);
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  const preferenceChanged=()=>{if(!automatic())pause();};
  reduced.addEventListener('change',preferenceChanged);desktop.addEventListener('change',preferenceChanged);
  connection?.addEventListener('change',preferenceChanged);
  controls('paused');
}

// Desktop hover previews; on touch screens every film stays in its gallery tile.
const galleryPreviews=[];
const stopGalleryPreviews=()=>galleryPreviews.forEach(p=>p.stop());
for(const link of document.querySelectorAll('.gallery-link[data-film]')) {
  const video=link.querySelector('.gallery-preview-video');
  const root=link.closest('.gallery-item');
  const bar=document.createElement('div');bar.className='gallery-film-controls';
  bar.innerHTML='<button type="button" class="gallery-film-toggle" aria-pressed="false">Play video</button><span class="gallery-film-time">0:00 / 0:06</span><button type="button" class="gallery-film-replay" aria-label="Replay video">↺</button><progress max="6" value="0" aria-label="Video playback progress"></progress><span class="gallery-film-status" role="status"></span>';
  link.after(bar);
  const toggle=bar.querySelector('.gallery-film-toggle'),time=bar.querySelector('.gallery-film-time'),progress=bar.querySelector('progress'),status=bar.querySelector('.gallery-film-status');
  let timer=null,hovering=false,token=0,manual=false,intent=false;
  video.muted=true;video.defaultMuted=true;video.playsInline=true;video.setAttribute('webkit-playsinline','');
  const sync=()=>{toggle.textContent=video.ended?'Replay video':intent?'Pause video':'Play video';toggle.setAttribute('aria-pressed',String(intent));link.setAttribute('aria-label',`${intent?'Pause':'Play'} video: ${link.dataset.caption}`);};
  const stop=(unload=true)=>{
    token++;intent=false;if(timer!==null){clearTimeout(timer);timer=null;}
    video.pause();status.textContent='';
    if(unload){manual=false;link.classList.remove('is-previewing');if(video.hasAttribute('src')){video.removeAttribute('src');video.load();}progress.value=0;time.textContent='0:00 / 0:06';}
    sync();
  };
  const start=async(explicit=false)=>{
    timer=null;
    if(document.hidden||document.querySelector('dialog[open]')||(!explicit&&(!hovering||!automatic())))return;
    // Keep the active tile's current time when resuming.
    for(const player of galleryPreviews)if(player.link!==link)player.stop();
    for(const player of controllers)if(player.link!==link)player.pause();
    manual=explicit;intent=true;const request=++token;sync();
    if(!video.getAttribute('src'))video.src=explicit&&!desktop.matches?link.dataset.small:link.getBoundingClientRect().width>600?link.dataset.large:link.dataset.small;
    if(video.error)video.load();
    if(video.ended)video.currentTime=0;
    try {await video.play();if(request===token&&intent)link.classList.add('is-previewing');}
    catch(error){if(request===token){intent=false;sync();if(error.name!=='AbortError')status.textContent='Tap Play video to retry.';}}
  };
  const playToggle=()=>intent?stop(false):start(true);
  toggle.addEventListener('click',playToggle);
  bar.querySelector('.gallery-film-replay').addEventListener('click',()=>{if(video.readyState>=1)video.currentTime=0;start(true);});
  link.addEventListener('summit:inline-play',playToggle);link.dataset.inlineReady='true';
  const syncMode=()=>{if(desktop.matches){link.removeAttribute('role');link.removeAttribute('aria-label');}else{link.setAttribute('role','button');sync();}};
  desktop.addEventListener('change',()=>{stop();syncMode();});syncMode();
  link.addEventListener('keydown',event=>{if(event.key==='Escape')stop(false);if(event.key===' '&&!desktop.matches){event.preventDefault();playToggle();}});
  link.addEventListener('pointerenter',event=>{if(event.pointerType==='touch')return;hovering=true;if(automatic())timer=setTimeout(()=>start(),220);});
  link.addEventListener('pointerleave',()=>{hovering=false;if(!manual)stop();});
  video.addEventListener('timeupdate',()=>{const duration=Number.isFinite(video.duration)?video.duration:6;progress.max=duration;progress.value=video.currentTime;time.textContent=`${formatTime(video.currentTime)} / ${formatTime(duration)}`;});
  video.addEventListener('ended',()=>{intent=false;sync();});
  video.addEventListener('error',()=>{link.classList.remove('is-previewing');intent=false;sync();if(manual)status.textContent='Video could not load. Tap Play video to retry.';});
  galleryPreviews.push({link,stop});controllers.add({link,pause:()=>stop(false)});
  if('IntersectionObserver' in window)new IntersectionObserver(entries=>{if(!entries[0].isIntersecting)stop(!manual);}).observe(link);
  document.addEventListener('summit:layout-change',()=>{if(root.hidden)stop();});
}
document.addEventListener('summit:viewer-open',()=>{stopGalleryPreviews();for(const player of controllers)player.pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopGalleryPreviews();});
const stopForPreferences=()=>{if(!automatic())stopGalleryPreviews();};
reduced.addEventListener('change',stopForPreferences);connection?.addEventListener('change',stopForPreferences);
