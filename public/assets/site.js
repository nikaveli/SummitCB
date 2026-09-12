document.documentElement.classList.add('js');
const menu = document.querySelector('.navigation');
const desktop = matchMedia('(min-width: 1101px)');
const syncMenu = () => { if (menu) menu.open = desktop.matches; };
syncMenu(); desktop.addEventListener('change', syncMenu);
document.addEventListener('keydown', event => { if (event.key === 'Escape' && menu?.open && !desktop.matches) { menu.open=false; menu.querySelector('summary').focus(); } });

// Capture only paths and hostnames, never query strings or form contents.
let attribution={landingPath:location.pathname,referringHost:''};
try {
  const referringHost=document.referrer ? new URL(document.referrer).hostname : '';
  attribution=JSON.parse(sessionStorage.getItem('summit-referral') || 'null') || {landingPath:location.pathname,referringHost:referringHost===location.hostname?'':referringHost};
  sessionStorage.setItem('summit-referral',JSON.stringify(attribution));
} catch { /* Session storage is optional. */ }

const filter=document.querySelector('.resource-filter');
if(filter) {
  const search=filter.querySelector('input'),topic=filter.querySelector('select');
  const apply=()=>{
    const terms=search.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    let count=0;
    document.querySelectorAll('.resource-item').forEach(item=>{
      item.hidden=!(terms.every(t=>item.dataset.search.includes(t))&&(!topic.value||item.dataset.topic===topic.value));
      if(!item.hidden)count++;
    });
    document.querySelector('#resource-count').textContent=`${count} ${count===1?'guide':'guides'} found`;
    document.querySelector('#no-resources').hidden=count>0;
    document.dispatchEvent(new CustomEvent('summit:layout-change',{detail:{root:document.querySelector('.resource-grid')}}));
  };
  filter.addEventListener('submit',e=>{e.preventDefault();apply();}); search.addEventListener('input',apply);topic.addEventListener('change',apply);
}

const form=document.querySelector('#consultation-form');
if(form) {
  const params=new URLSearchParams(location.search);
  for(const field of ['service','city']) if([...form.elements[field].options].some(o=>o.value===params.get(field)))form.elements[field].value=params.get(field);
  form.elements.landingPath.value=attribution.landingPath||location.pathname;
  form.elements.referringHost.value=attribution.referringHost||'';
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(!form.reportValidity())return;
    const button=form.querySelector('button[type=submit]'),status=form.querySelector('.form-status');
    button.disabled=true;button.textContent='Sending your request…';status.textContent='';
    form.querySelectorAll('.field-error').forEach(el=>el.remove());
    form.querySelectorAll('[aria-invalid]').forEach(el=>{el.removeAttribute('aria-invalid');el.removeAttribute('aria-describedby');});
    try {
      const response=await fetch(form.action,{method:'POST',body:new URLSearchParams(new FormData(form)),headers:{Accept:'application/json'},signal:AbortSignal.timeout(20000)});
      const result=await response.json();
      if(!response.ok) {
        status.textContent=result.message||'Your request could not be recorded. Please try again or call 720-431-1056.';
        for(const [field,message] of Object.entries(result.errors||{})) {
          const input=form.elements[field]; if(!input)continue;
          const error=document.createElement('span');error.className='field-error';error.id=field+'-error';error.textContent=message;
          input.setAttribute('aria-invalid','true');input.setAttribute('aria-describedby',error.id);input.after(error);
        }
        status.focus(); return;
      }
      if(result.saved===true)location.assign('/thank-you/');
      else {status.textContent='Your request was not recorded. Please call 720-431-1056.';status.focus();}
    } catch {
      status.textContent='We could not confirm receipt. Your details are still here. Please try again or call 720-431-1056.';status.focus();
    } finally {button.disabled=false;button.innerHTML='Request a consultation <span aria-hidden="true">↗</span>';}
  });
}

// Gallery anchors remain ordinary full-image links without JavaScript.
const photoGallery=document.querySelector('.photo-gallery');
if(photoGallery) {
  const items=[...photoGallery.querySelectorAll('.gallery-item')];
  const count=document.querySelector('.photo-count');
  document.querySelectorAll('[data-photo-filter]').forEach(button=>button.addEventListener('click',()=>{
    const group=button.dataset.photoFilter;
    document.querySelectorAll('[data-photo-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    items.forEach(item=>item.hidden=group!=='all'&&item.dataset.photoGroup!==group);
    count.textContent=`${items.filter(item=>!item.hidden).length} views · Select a photo or video for a closer look.`;
    document.dispatchEvent(new CustomEvent('summit:layout-change',{detail:{root:photoGallery}}));
  }));
  const dialog=document.querySelector('.photo-dialog');
  if(dialog&&typeof dialog.showModal==='function') {
    const image=dialog.querySelector('img'),caption=dialog.querySelector('#photo-dialog-caption'),film=dialog.querySelector('.gallery-full-film');
    const stopFilm=()=>{film.pause();film.removeAttribute('src');film.load();};
    let current=0,links=[],trigger=null;
    const show=index=>{
      current=(index+links.length)%links.length;
      const a=links[current];stopFilm();
      const isFilm=!!a.dataset.film;image.hidden=isFilm;film.hidden=!isFilm;
      if(isFilm){
        document.dispatchEvent(new Event('summit:viewer-open'));
        film.poster=a.querySelector('img').currentSrc||a.querySelector('img').src;
        film.setAttribute('aria-label',a.dataset.alt);film.muted=true;
        const compact=innerWidth<900||navigator.connection?.saveData||['slow-2g','2g','3g'].includes(navigator.connection?.effectiveType);
        film.src=compact?a.dataset.small:a.dataset.large;film.play().catch(()=>{});
      }else{image.src=a.href;image.alt=a.dataset.alt;}
      caption.textContent=`${a.dataset.caption}${isFilm?' · Video':''} · ${current+1} / ${links.length}`;
    };
    photoGallery.addEventListener('click',event=>{
      const a=event.target.closest('[data-photo-view]');
      if(!a||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0)return;
      const inlineFilms=!matchMedia('(min-width: 900px) and (hover: hover) and (pointer: fine)').matches;
      if(a.dataset.film&&inlineFilms) {
        if(a.dataset.inlineReady==='true'){event.preventDefault();a.dispatchEvent(new Event('summit:inline-play'));}
        return;
      }
      event.preventDefault();trigger=a;links=items.filter(item=>!item.hidden).map(item=>item.querySelector('[data-photo-view]')).filter(link=>!inlineFilms||!link.dataset.film);
      document.dispatchEvent(new Event('summit:viewer-open'));dialog.showModal();show(links.indexOf(a));dialog.querySelector('.photo-close').focus();
    });
    const closeViewer=()=>{stopFilm();dialog.close();};
    dialog.addEventListener('cancel',stopFilm);
    dialog.querySelector('.photo-close').addEventListener('click',closeViewer);
    dialog.querySelector('.photo-previous').addEventListener('click',()=>show(current-1));
    dialog.querySelector('.photo-next').addEventListener('click',()=>show(current+1));
    dialog.addEventListener('keydown',event=>{
      if(event.target===film)return;
      if(event.key==='ArrowLeft'){event.preventDefault();show(current-1);}
      if(event.key==='ArrowRight'){event.preventDefault();show(current+1);}
    });
    dialog.addEventListener('click',event=>{
      const r=dialog.getBoundingClientRect();
      if(event.target===dialog&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom))closeViewer();
    });
    dialog.addEventListener('close',()=>{stopFilm();trigger?.focus({preventScroll:true});});
  }
}
