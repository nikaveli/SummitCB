/* Adapted from the supplied Osmo Image Sequence on Scroll resource.
   Native sticky layout, progressive WebP loading, bounded decoded memory. */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const {gsap, ScrollTrigger} = window;
  const menu = document.querySelector('.home-menu');
  document.addEventListener('keydown', e => {
    if(e.key === 'Escape' && menu?.open){menu.open=false;menu.querySelector('summary').focus();}
  });
  if (!gsap || !ScrollTrigger) return; // The server-rendered photo and links remain usable.
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ignoreMobileResize:true});

  document.querySelectorAll('[data-sequence-wrap]').forEach(wrap => {
    if (wrap.dataset.sequenceInit === 'true') return;
    wrap.dataset.sequenceInit = 'true';
    const element=wrap.querySelector('[data-sequence-element]');
    const canvas=wrap.querySelector('[data-sequence-canvas]');
    const sticky=wrap.querySelector('.image-sequence__sticky');
    const ctx=canvas?.getContext('2d',{alpha:false});
    if(!element || !canvas || !sticky || !ctx) return;
    const frames=Number(canvas.dataset.frames)||1, first=Number(canvas.dataset.indexStart)||0;
    const last=first+frames-1, digits=Number(canvas.dataset.digits)||3;
    const opening=wrap.querySelector('.sequence-copy--opening'), ending=wrap.querySelector('.sequence-copy--ending');
    const bar=wrap.querySelector('.sequence-progress span');
    const cache=new Map(), compressed=new Map(), pending=new Map(), failed=new Set();
    let source='', sourceWidth=1920, sourceHeight=1080, generation=0, queue=[], target=first;
    let progress=0, goal=0, direction=1, drawn=-1, resizeTimer, drawRAF=0, followRAF=0, previousTime=0, trigger, enabled=false, inView=true;
    let wanted=new Set();
    const cacheLimit=matchMedia('(pointer:coarse)').matches?20:16;
    const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
    const url=i=>`${source}${String(i).padStart(digits,'0')}.${canvas.dataset.filetype||'webp'}`;
    const breadth=(a,b)=>{const result=[],ranges=[[a,b]];while(ranges.length){const [x,y]=ranges.shift();if(y-x>1){const m=Math.floor((x+y)/2);result.push(m);ranges.push([x,m],[m,y]);}}return result;};
    const progressive=[first,last,...breadth(first,last)];

    function sizeCanvas(){
      // Extra pixels beyond source detail only cost memory and make phone draws slower.
      const w=element.clientWidth,h=element.clientHeight;
      const ratio=Math.min(devicePixelRatio||1,sourceWidth/w,sourceHeight/h);
      const width=Math.max(1,Math.round(w*ratio)),height=Math.max(1,Math.round(h*ratio));
      if(canvas.width!==width || canvas.height!==height){canvas.width=width;canvas.height=height;drawn=-1;}
    }
    function draw(){
      drawRAF=0;if(!enabled || !cache.size)return;
      // Hold the current image during a late decode rather than jumping to a distant frame.
      const candidates=[...cache.keys()].filter(i=>drawn<0 || (direction>0?i>=drawn&&i<=target:i<=drawn&&i>=target));
      if(!cache.has(target)&&!candidates.length)return;
      const index=cache.has(target)?target:candidates.reduce((a,b)=>Math.abs(b-target)<Math.abs(a-target)?b:a);
      if(index===drawn)return;
      const img=cache.get(index),scale=Math.max(canvas.width/img.width,canvas.height/img.height);
      ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
      ctx.drawImage(img,(canvas.width-img.width*scale)/2,(canvas.height-img.height*scale)/2,img.width*scale,img.height*scale);
      drawn=index;wrap.dataset.sequenceFrame=String(index);wrap.classList.add('is-ready');
    }
    function scheduleDraw(){if(!drawRAF)drawRAF=requestAnimationFrame(draw);}
    function trimCache(){
      while(cache.size>cacheLimit){
        const removable=[...cache.keys()].filter(i=>i!==drawn && i!==target);
        const far=removable.sort((a,b)=>Math.abs(b-target)-Math.abs(a-target))[0];
        if(far===undefined)break;cache.get(far).close?.();cache.delete(far);
      }
    }
    function load(i){
      const epoch=generation,controller=new AbortController(),frameURL=url(i);
      pending.set(i,controller);
      (compressed.has(i)?Promise.resolve(compressed.get(i)):fetch(frameURL,{signal:controller.signal}).then(r=>{if(!r.ok)throw new Error(`Frame ${i}: ${r.status}`);return r.blob()}))
        .then(async blob=>{
          if(epoch!==generation || !enabled)return null;
          compressed.set(i,blob);
          // Keep distant frames compressed; only nearby frames spend decoded memory/CPU.
          if(!wanted.has(i))return null;
          if(window.createImageBitmap)return createImageBitmap(blob);
          const img=new Image();img.src=frameURL;await img.decode();return img;
        }).then(img=>{
          if(!img)return;
          if(epoch!==generation || !enabled){img.close?.();return;}
          cache.set(i,img);trimCache();scheduleDraw();
        }).catch(error=>{
          if(epoch===generation && error.name!=='AbortError')failed.add(i);
        }).finally(()=>{
          if(epoch!==generation)return;
          pending.delete(i);wrap.dataset.sequenceCached=String(cache.size);pump();
        });
    }
    function pump(){
      if(!enabled || !inView || document.hidden)return;
      while(pending.size<3 && queue.length){const i=queue.shift();if(!cache.has(i)&&!pending.has(i)&&!failed.has(i)&&(!compressed.has(i)||wanted.has(i)))load(i);}
    }
    function requestFrames(){
      const near=[target,first+Math.round(goal*(frames-1))];
      for(let r=1;r<=8;r++){near.push(target+r*direction);if(r<=4)near.push(target-r*direction);}
      wanted=new Set(near.filter(i=>i>=first&&i<=last));
      queue=[...new Set([...wanted,...progressive.filter(i=>!compressed.has(i))])];
      pump();
    }
    function follow(time){
      followRAF=0;
      const elapsed=previousTime?time-previousTime:16.7;previousTime=time;
      const next=progress+(goal-progress)*(1-Math.exp(-elapsed/110));
      if(Math.abs(goal-next)<.0005){render(goal);previousTime=0;return;}
      render(next);followRAF=requestAnimationFrame(follow);
    }
    function update(value,immediate=false){
      const next=Math.max(0,Math.min(1,value));
      if(next!==goal)direction=next>goal?1:-1;
      goal=next;
      // The final image must be reached exactly when native sticky positioning releases.
      if(immediate || goal===0 || goal===1){cancelAnimationFrame(followRAF);followRAF=0;previousTime=0;render(goal);}
      else if(!followRAF)followRAF=requestAnimationFrame(follow);
    }
    function render(value){
      progress=Math.max(0,Math.min(1,value));target=first+Math.round(progress*(frames-1));
      const intro=1-smooth(.05,.32,progress),outro=smooth(.74,.96,progress);
      opening.style.opacity=intro;opening.style.transform=`translateY(${-18*(1-intro)}px)`;
      ending.style.opacity=outro;ending.style.visibility=outro>0?'visible':'hidden';ending.style.transform=`translateY(${18*(1-outro)}px)`;
      ending.inert=outro<.5;ending.setAttribute('aria-hidden',String(outro<.5));
      bar.style.transform=`scaleX(${progress})`;
      const rect=wrap.getBoundingClientRect();inView=rect.bottom>0&&rect.top<innerHeight;
      if(enabled){scheduleDraw();requestFrames();}
    }
    function resetFrames(){
      generation++;pending.forEach(c=>c.abort());pending.clear();
      cache.forEach(img=>img.close?.());cache.clear();compressed.clear();failed.clear();wanted.clear();queue=[];drawn=-1;
    }
    function selectSource(){
      const portrait=element.clientWidth<=860 && element.clientWidth/element.clientHeight<=.75;
      const next=portrait?canvas.dataset.mobileSrc:canvas.dataset.desktopSrc;
      if(source!==next){resetFrames();source=next;sourceWidth=portrait?810:1920;sourceHeight=1080;}
      sizeCanvas();
    }
    function mount(){
      trigger?.kill();trigger=null;enabled=false;resetFrames();cancelAnimationFrame(drawRAF);drawRAF=0;
      wrap.classList.remove('is-enhanced','is-ready');update(0,true);
      if(reduce.matches)return;
      enabled=true;wrap.classList.add('is-enhanced');selectSource();
      trigger=ScrollTrigger.create({
        id:'summit-hero-sequence',trigger:wrap,start:wrap.dataset.scrollStart||'top top',
        // 'bottom bottom' must match the actual sticky height, including svh on phones.
        end:()=>wrap.dataset.scrollEnd==='bottom bottom'?`+=${Math.max(1,wrap.offsetHeight-sticky.offsetHeight)}`:(wrap.dataset.scrollEnd||'bottom bottom'),
        invalidateOnRefresh:true,onUpdate:self=>update(self.progress),onRefresh:self=>update(self.progress,true),
        onToggle:()=>{const r=wrap.getBoundingClientRect();inView=r.bottom>0&&r.top<innerHeight;pump();}
      });
      update(trigger.progress,true);ScrollTrigger.refresh();
    }
    let lastWidth=element.clientWidth;
    window.addEventListener('resize',()=>{
      // A mobile URL bar should not extend the journey or restart the sequence.
      if(matchMedia('(pointer:coarse)').matches&&element.clientWidth===lastWidth)return;
      clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{
        lastWidth=element.clientWidth;if(!enabled)return;selectSource();ScrollTrigger.refresh();update(trigger.progress,true);
      },150);
    },{passive:true});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&enabled){update(trigger.progress,true);}});
    reduce.addEventListener('change',mount);mount();
    wrap.querySelector('.sequence-explore').addEventListener('click',event=>{
      const content=document.getElementById('home-content');if(!content)return;
      event.preventDefault();window.scrollTo({top:content.getBoundingClientRect().top+window.scrollY,behavior:'instant'});content.focus({preventScroll:true});
      history.replaceState(null,'','#home-content');
    });
  });
})();
