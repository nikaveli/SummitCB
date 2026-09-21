/* ============================================================================
   scroll-world — portable scroll-scrubbed camera-flight engine
   ----------------------------------------------------------------------------
   Framework-agnostic. Vanilla JS, zero dependencies. It builds its own DOM and
   injects its own (namespaced) CSS into a container you give it, so it drops into
   plain HTML, Next.js (call from a ref/useEffect), Vue (onMounted), a server-
   rendered page, anything.

   USAGE
     mountScrollWorld(document.getElementById('world'), {
       brand: { name: 'Pearl & Co.', href: '#top' },
       diveScroll: 1.3,   // viewport-heights of scroll per dive clip
       connScroll: 0.9,   // ...per connector clip
       hint: 'scroll to fly in',
       nav: true,         // show the top section nav
       atmosphere: true,  // subtle gradient + drifting particles behind the clips
       sections: [
         { id, label, still, clip, clipMobile, clipPortrait, accent,
           scroll: 1.6,   // optional per-section override of diveScroll — more scroll
                          // distance = a slower, longer dwell in this scene
           linger: 0.5,   // optional 0..1 — remaps time so the camera settles mid-scene
                          // (exactly where the copy peaks) and moves quicker at the
                          // edges. 0 = linear (default). Keep ≤ 0.6; 1 = full pause.
           eyebrow, title, body, tags:[…],
           cta:{ primary:{label,href}, secondary:{label,href} } }, // last section only
         …
       ],
       connectors: [clipUrl, …],          // length = sections.length - 1 (nulls allowed)
       connectorsMobile: [clipUrl, …],    // optional lighter connectors for phones (same length)

   PORTRAIT QUALITY
     clipPortrait is an optional centered 960×1080 crop of a 1920×1080 master.
     It is selected by viewport aspect ratio, retaining native detail on phones.
     Rotation selects the full landscape master and keeps the old frame until ready.

   MOBILE (the clipMobile/connectorsMobile variants are the opt-in "mobile beta";
   the rest of the phone handling below is always on)
     The engine is phone-aware out of the box: on a coarse-pointer / ≤860px viewport it
       - loads `clipMobile` / `connectorsMobile` when provided (encode these smaller +
         tighter-GOP — seek cost on a phone decoder is dominated by frames-from-keyframe,
         so a 720p, -g 4 file scrubs far smoother than the 1080p desktop master; see
         pipeline.md). Falls back to the desktop `clip` if no mobile variant is given.
       - coalesces seeks (never issues a new currentTime while the decoder is still
         `seeking`) so fast flicks can't pile up and freeze the video.
       - keeps the still as a live poster until the clip actually paints its first frame,
         and primes each video (muted play→pause) on first touch — this is what stops iOS
         from showing a blank scene before the first seek.
       - drops the drifting particles and ignores URL-bar-only resizes (no scroll jump).
     Nothing here is required — a config with only `clip`/`connectors` still works on
     phones; the mobile variants just make it lighter and smoother.

   THEME (CSS custom properties; set on the container or :root to override)
     --sw-bg         page background (match your scene bg for seamless posters)
     --sw-ink        primary text
     --sw-ink-soft   secondary text
     --sw-accent     default accent (each section overrides via its `accent`)
     --sw-font-display / --sw-font-body

   REQUIREMENTS ON YOUR ASSETS
     - clips encoded for fast local scrubbing, frequent keyframes, +faststart, no audio
     - connectors' endpoints are the neighbouring dives' ACTUAL frames (see SKILL Step 5)
     - (optional) mobile variants at ~720p, -g 4 for smoother phone scrubbing
   The engine downloads each nearby clip once into a browser Blob and scrubs it
   locally, so smooth seeking does not depend on a host's byte-range behavior.
   ========================================================================== */

function mountScrollWorld(container, config) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Phone detection. `coarse` is captured once (input type doesn't change mid-session);
  // the ≤860px query is read live via isMobile() so a desktop resize/DevTools toggle
  // switches sources and seek behaviour without a reload.
  const coarse = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  const smallMQ = window.matchMedia('(max-width: 860px)');
  const isMobile = () => coarse || smallMQ.matches;
  const SECTIONS = config.sections || [];
  const CONNECTORS = config.connectors || [];
  const CONNECTORS_M = config.connectorsMobile || [];
  const DIVE_W = config.diveScroll || 1.3;
  const CONN_W = config.connScroll || 0.9;
  const CROSSFADE = (config.crossfade != null) ? config.crossfade : 0.12;  // seam dissolve width (vh)
  const N = SECTIONS.length;
  if (!N) return;

  // Styles are provided by the external homepage stylesheet.
  container.classList.add('sw-root');
  const contained = config.contained === true;
  if (contained) container.classList.add('sw-contained');

  // ---- build the interleaved segment chain: dive0, conn0, dive1, … diveN-1 ----
  const SEGMENTS = [];
  SECTIONS.forEach((s, i) => {
    const dive = { kind: 'dive', si: i, clip: s.clip, clipM: s.clipMobile, clipPortrait: s.clipPortrait, still: s.still, poster: s.poster, accent: s.accent,
                   w: s.scroll || DIVE_W, linger: s.linger || 0 };
    SEGMENTS.push(dive);
    s._seg = dive;
    // A connector is optional: if connectors[i] is falsy, the two dives simply
    // crossfade directly (no fly-over). Lets a page complete even when a
    // connector can't be generated (e.g. a content-filter false-positive).
    if (i < N - 1 && CONNECTORS[i]) {
      SEGMENTS.push({ kind: 'conn', si: i, clip: CONNECTORS[i], clipM: CONNECTORS_M[i],
                      still: SECTIONS[i + 1].still, accent: SECTIONS[i + 1].accent, w: CONN_W });
    }
  });
  const NSEG = SEGMENTS.length;

  // ---- DOM ----
  const sky = el('div', 'sw-sky');
  if (config.atmosphere !== false) {
    sky.appendChild(el('div', 'sw-sky__grad'));
    sky.appendChild(el('div', 'sw-sky__glow'));
  }
  const particles = el('div', 'sw-particles'); sky.appendChild(particles);

  const scrollbar = el('div', 'sw-scrollbar');
  const scrollbarFill = el('span'); scrollbar.appendChild(scrollbarFill);

  const topbar = el('div', 'sw-topbar');
  if (config.brand) {
    const brand = el('a', 'sw-brand'); brand.href = (config.brand.href || '#');
    brand.appendChild(el('span', 'sw-brand__mark'));
    const nm = el('span', 'sw-brand__name'); nm.textContent = config.brand.name || ''; brand.appendChild(nm);
    topbar.appendChild(brand);
  }
  const nav = el('nav', 'sw-nav'); if (config.nav !== false) topbar.appendChild(nav);
  if (config.cta && config.cta.label) {
    const c = el('a', 'sw-topcta'); c.href = config.cta.href || '#'; c.textContent = config.cta.label;
    topbar.appendChild(c);
  }

  const stage = el('div', 'sw-stage');
  const copylayer = el('div', 'sw-copylayer');
  const route = el('div', 'sw-route');
  const hint = el('div', 'sw-hint');
  const hintText = el('span'); hintText.textContent = config.hint || 'scroll'; hint.appendChild(hintText);
  hint.appendChild(el('i'));
  const track = el('div', 'sw-track');

  const viewport = contained ? el('div', 'sw-viewport') : container;
  if (contained) container.appendChild(viewport);
  [sky, scrollbar, topbar, stage, copylayer, route, hint].forEach(n => viewport.appendChild(n));
  container.appendChild(track);

  // segment scenes
  SEGMENTS.forEach(s => {
    const scene = el('div', 'sw-scene'); scene.style.setProperty('--sw-accent', s.accent || '');
    const img = el('img', 'sw-scene__still'); img.alt = ''; img.decoding = 'async'; img.loading = 'lazy';
    if (s.still) img.src = !reduce && s.poster ? s.poster : s.still;
    scene.appendChild(img); stage.appendChild(scene);
    s.el = scene; s.img = img; s.video = null; s.hasClip = false;
    s.loading = false; s.ready = false; s.cur = 0; s.target = 0; s.visible = false;
  });

  // per-section copy / route / nav
  const copies = [], dots = [];
  SECTIONS.forEach((s, i) => {
    const c = el('article', 'sw-copy'); c.style.setProperty('--sw-accent', s.accent || '');
    c.innerHTML =
      `<span class="sw-copy__num">${pad(i + 1)} / ${pad(N)}</span>` +
      (s.eyebrow ? `<span class="sw-copy__eyebrow">${esc(s.eyebrow)}</span>` : '') +
      (s.title ? `<h2 class="sw-copy__title">${esc(s.title)}</h2>` : '') +
      (s.body ? `<p class="sw-copy__body">${esc(s.body)}</p>` : '') +
      (s.tags && s.tags.length ? `<ul class="sw-copy__tags">${s.tags.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : '') +
      (s.cta ? `<div class="sw-copy__cta">${ctaBtns(s.cta)}</div>` : '');
    copylayer.appendChild(c); copies.push(c);

    const dot = el('button', 'sw-route__dot'); dot.style.setProperty('--sw-accent', s.accent || '');
    dot.setAttribute('aria-label', s.label || `Chapter ${i + 1}`);
    dot.innerHTML = `<span class="sw-route__label">${esc(s.label || '')}</span><i></i>`;
    dot.addEventListener('click', () => jumpTo(i)); route.appendChild(dot); dots.push(dot);

    if (config.nav !== false) {
      const b = el('button', 'sw-nav__item'); b.textContent = s.label || '';
      b.addEventListener('click', () => jumpTo(i)); nav.appendChild(b);
    }
  });

  // ---- math ----
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
  // Per-section dwell: monotone remap of scroll→time so the camera settles mid-scene
  // (where the copy peaks) and moves quicker near the seams. L=0 linear, L=1 full
  // mid-scene pause. f(0)=0, f(1)=1 always, so seam frames are untouched.
  const lingerEase = (x, L) => { L = clamp(L); const c = x - 0.5; return (1 - L) * x + L * (4 * c * c * c + 0.5); };
  let vh = window.innerHeight, stageX = 0, totalW = 0, activeIndex = -1, ticking = false;
  let laidOutW = window.innerWidth;   // width the current layout was computed at (see onResize)

  function layout() {
    vh = window.innerHeight;
    laidOutW = window.innerWidth;
    stageX = window.innerWidth > 860 ? 4 : 0;
    let off = 0;
    SEGMENTS.forEach(s => { s.start = off * vh; off += s.w; s.end = off * vh; });
    totalW = off;
    track.style.height = (totalW * vh + (contained ? 0 : vh)) + 'px';
    read();
  }

  function jumpTo(i) {
    const seg = SECTIONS[i]._seg;
    const offset = contained ? container.getBoundingClientRect().top + window.scrollY : 0;
    window.scrollTo({ top: offset + seg.start + (seg.end - seg.start) * (i === 0 ? 0 : 0.5), behavior: reduce ? 'auto' : 'smooth' });
  }

  // Portrait assets preserve the full native 1080px height while avoiding
  // decoding the invisible sides. Wider viewports must use the landscape master.
  function clipURL(s) {
    const frame = viewport.getBoundingClientRect();
    if (s.clipPortrait && frame.width / frame.height <= 960 / 1080) return s.clipPortrait;
    return s.clipPortrait ? s.clip : ((isMobile() && s.clipM) ? s.clipM : s.clip);
  }

  function loadClip(s) {
    // Under prefers-reduced-motion we never load the clips at all — the stills stay up
    // and simply cross-dissolve as you scroll. No scrubbed video motion, no decode cost.
    if (reduce || !s.clip) return;
    const url = clipURL(s);
    if (s.loading && s.url === url) {
      if (userReady && s.visible) primeVideo(s.video);
      return;
    }
    s.loading = true; s.ready = false; s.url = url;
    // Give the scene a real media element immediately, then fetch the compact
    // scrub asset once. Local Blob playback makes every later seek independent
    // of CDN byte-range behavior and prevents repeated network stalls.
    const v = document.createElement('video');
    v.className = 'sw-scene__video';
    v.muted = true; v.defaultMuted = true; v.playsInline = true; v.preload = 'auto';
    v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
    v.setAttribute('webkit-playsinline', '');
    v.setAttribute('aria-hidden', 'true'); v.tabIndex = -1;
    v.addEventListener('loadedmetadata', () => {
      if (s.video !== v) return;
      s.ready = true; read(); s.cur = s.target;
      if (s.target > 0) v.currentTime = clamp(s.target, 0, 0.999) * v.duration;
    });
    const reveal = () => {
      if (s.video !== v || v.readyState < 2 || v.seeking) return;
      v.classList.add('is-ready'); s.el.classList.add('has-clip');
      // Keep the previous orientation's painted frame until its replacement is ready.
      s.el.querySelectorAll('video').forEach(old => {
        if (old !== v) {
          old.pause(); old.removeAttribute('src'); old.load();
          if (old._swBlobUrl) URL.revokeObjectURL(old._swBlobUrl);
          old.remove();
        }
      });
    };
    // These events guarantee a decoded current frame. A paused video may never
    // produce another requestVideoFrameCallback after loadeddata.
    const painted = () => requestAnimationFrame(reveal);
    v.addEventListener('seeked', painted);
    v.addEventListener('canplay', painted);
    v.addEventListener('loadeddata', () => { painted(); if (userReady && s.visible) primeVideo(v); });
    v.addEventListener('error', () => {
      if (s.video !== v) return;
      s.ready = false; s.loading = false; s.hasClip = false; s.el.classList.remove('has-clip');
      s.el.querySelectorAll('video').forEach(old => {
        old.pause();
        if (old._swBlobUrl) URL.revokeObjectURL(old._swBlobUrl);
        old.remove();
      });
      s.video = null;
    });
    s.el.appendChild(v); s.video = v; s.hasClip = true;
    if (s.fetchAbort) s.fetchAbort.abort();
    const controller = new AbortController(); s.fetchAbort = controller;
    fetch(url, { signal: controller.signal, cache: 'force-cache' })
      .then(response => {
        if (!response.ok) throw new Error(`Hero clip returned ${response.status}`);
        return response.blob();
      })
      .then(blob => {
        if (s.video !== v) return;
        const blobUrl = URL.createObjectURL(blob);
        v._swBlobUrl = blobUrl; v.src = blobUrl; v.load();
      })
      .catch(error => {
        if (error.name === 'AbortError' || s.video !== v) return;
        s.ready = false; s.loading = false; s.hasClip = false; s.video = null;
        v.remove();
      });
    if (userReady && s.visible) primeVideo(v);
  }

  function read() {
    const offset = contained ? container.getBoundingClientRect().top + window.scrollY : 0;
    const y = clamp((window.scrollY || window.pageYOffset) - offset, 0, totalW * vh);
    const fade = CROSSFADE * vh;
    let ci = 0;
    for (let i = 0; i < NSEG; i++) if (y >= SEGMENTS[i].start) ci = i;

    for (let i = 0; i < NSEG; i++) {
      const s = SEGMENTS[i];
      if (y > s.start - 1.6 * vh && y < s.end + 1.6 * vh) loadClip(s);
      const local = clamp((y - s.start) / (s.end - s.start), 0, 1);
      s.target = s.linger ? lingerEase(local, s.linger) : local;
      let outside = 0;
      if (y < s.start) outside = s.start - y; else if (y > s.end) outside = y - s.end;
      const op = smooth(1 - outside / fade);
      s.el.style.opacity = op; s.visible = op > 0.001;
      s.el.style.zIndex = (i === ci) ? '120' : String(100 + Math.round(op * 10));
      if (!s.hasClip || !s.ready) {
        const sc = reduce ? 1 : 1.03 + local * 0.14;
        s.img.style.transform = `translateX(${stageX - 2}vw) scale(${sc.toFixed(3)})`;
      }
    }

    let copyOpacity = 0;
    for (let i = 0; i < N; i++) {
      const seg = SECTIONS[i]._seg;
      const pr = clamp((y - seg.start) / (seg.end - seg.start), 0, 1);
      const before = y < seg.start, after = y > seg.end;
      let cop;
      if (i === 0) cop = after ? 0 : smooth(1 - pr / 0.62);            // greets on landing
      else if (i === N - 1) cop = before ? 0 : smooth(pr / 0.4);       // holds CTA at the end
      else cop = (before || after) ? 0 : smooth(1 - Math.abs(pr - 0.5) / 0.5);
      copyOpacity = Math.max(copyOpacity, cop);
      const c = copies[i];
      c.style.opacity = cop;
      c.style.transform = reduce ? 'none' : `translateY(${(0.5 - pr) * 4}vh)`;
      c.style.pointerEvents = cop > 0.5 ? 'auto' : 'none';
      c.inert = cop <= 0.5;
      c.setAttribute('aria-hidden', cop <= 0.5 ? 'true' : 'false');
    }

    copylayer.style.setProperty('--sw-copy-opacity', copyOpacity.toFixed(3));

    const cur = SEGMENTS[ci];
    const near = clamp(cur.kind === 'dive' ? cur.si
      : (((y - cur.start) / (cur.end - cur.start)) > 0.5 ? cur.si + 1 : cur.si), 0, N - 1);
    if (near !== activeIndex) {
      activeIndex = near;
      dots.forEach((d, k) => { d.classList.toggle('is-active', k === near); d.setAttribute('aria-pressed', String(k === near)); });
      nav.querySelectorAll('.sw-nav__item').forEach((n, k) => n.classList.toggle('is-active', k === near));
      container.style.setProperty('--sw-accent', SECTIONS[near].accent || '');
    }
    scrollbarFill.style.transform = `scaleX(${clamp(y / (totalW * vh))})`;
    hint.style.opacity = clamp(1 - y / (0.5 * vh));
    if (particles) particles.style.transform = `translate3d(0, ${-y * 0.05}px, 0)`;
    ticking = false;
  }

  let lastFrame = 0;
  function raf(now) {
    // Match the original easing at 60Hz without stretching catch-up on slow CPUs.
    const elapsed = lastFrame ? Math.min(100, now - lastFrame) : 16.67;
    lastFrame = now;
    const follow = 1 - Math.exp(-elapsed / 84);
    const eps = isMobile() ? 0.02 : 0.008;   // coarser seek step on phones = fewer decodes
    for (let i = 0; i < NSEG; i++) {
      const s = SEGMENTS[i];
      // Reconcile media readiness every frame as a safety net. A fully cached
      // asset can advance readyState before a deferred media event is observed;
      // without this check the clip can remain painted at time zero until a
      // later scroll happens to retrigger the path.
      if (s.video && !s.ready && s.video.readyState >= 1) s.ready = true;
      if (s.video && s.video.readyState >= 2 && !s.video.seeking) {
        s.video.classList.add('is-ready');
        s.el.classList.add('has-clip');
      }
      if (!s.hasClip || !s.ready || !s.video) continue;
      // Never queue a seek while the decoder is still resolving the last one.
      // On phones a fast flick would otherwise pile up seeks and freeze the clip;
      // cur keeps lerping, so we snap to the latest target the moment it's free.
      s.cur += (s.target - s.cur) * (reduce ? 1 : follow);
      if (s.video.seeking) continue;
      if (!s.visible && Math.abs(s.cur - s.target) < 0.002) continue;
      const dur = s.video.duration || 1;
      const t = clamp(s.cur, 0, 0.999) * dur;
      if (Math.abs(s.video.currentTime - t) > eps) { try { s.video.currentTime = t; } catch (e) {} }
    }
    requestAnimationFrame(raf);
  }

  // Retry on later gestures when the first swipe preceded media readiness or
  // the browser blocked playback. A one-shot listener can strand later scenes.
  let userReady = false;
  const primed = new WeakSet(), priming = new WeakSet();
  function primeVideo(v) {
    if (!isMobile() || !v || primed.has(v) || priming.has(v)) return;
    priming.add(v);
    try {
      Promise.resolve(v.play()).then(() => {
        v.pause(); primed.add(v); read();
      }).catch(() => {}).finally(() => priming.delete(v));
    } catch { priming.delete(v); }
  }
  function onGesture() {
    userReady = true;
    // Prime the visible chapter inside the gesture. Muted inline playback can
    // prime later chapters when they become visible; starting all three here
    // would compete for bandwidth and decoders on the very first swipe.
    SEGMENTS.forEach(s => { if (s.visible) primeVideo(s.video); });
  }
  window.addEventListener('pointerdown', onGesture, { passive: true });
  window.addEventListener('touchstart', onGesture, { passive: true });

  // Particles are a per-frame cost we can't afford alongside video scrubbing on a phone.
  seedParticles(particles, reduce || coarse || config.atmosphere === false);
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(read); } }, { passive: true });
  // Mobile browsers fire `resize` every time the URL bar slides in/out. Re-running
  // layout() there rebuilds the track height and yanks the scroll position, so on
  // touch we ignore height-only changes and only relayout when the width actually
  // changes (rotation still comes through orientationchange). layout() records the
  // width it laid out at.
  function onResize() {
    if (coarse && window.innerWidth === laidOutW) return;
    layout();
    SEGMENTS.forEach(s => { if (s.video) loadClip(s); });
  }
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', layout);
  window.addEventListener('load', layout);
  layout();
  requestAnimationFrame(raf);

  // ---- helpers ----
  function el(tag, cls) { const n = document.createElement(tag); if (cls) n.className = cls; return n; }
  function pad(n) { return String(n).padStart(2, '0'); }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function ctaBtns(cta) {
    let h = '';
    if (cta.primary) h += `<a class="sw-btn sw-btn--primary" href="${esc(cta.primary.href || '#')}">${esc(cta.primary.label)}</a>`;
    if (cta.secondary) h += `<a class="sw-btn sw-btn--ghost" href="${esc(cta.secondary.href || '#')}">${esc(cta.secondary.label)}</a>`;
    return h;
  }
}

function seedParticles(host, reduce) {
  if (!host || reduce) return;
  const kinds = ['dot', 'dot', 'ring'];
  const seeds = [7, 23, 41, 58, 71, 88, 12, 34, 52, 66, 83, 95, 18, 29, 47, 63, 77, 91, 5, 38, 55, 69, 82, 97];
  for (let k = 0; k < 20; k++) {
    const s = document.createElement('span');
    s.className = 'sw-pt sw-pt--' + kinds[k % kinds.length];
    s.style.left = seeds[k % seeds.length] + 'vw';
    s.style.top = ((seeds[(k * 3) % seeds.length] * 1.3) % 100) + 'vh';
    s.style.setProperty('--sw-sc', (0.5 + ((seeds[(k * 5) % seeds.length] % 60) / 60) * 1.1).toFixed(2));
    const dur = 14 + (seeds[(k * 7) % seeds.length] % 22);
    s.style.animationDuration = dur + 's';
    s.style.animationDelay = (-(seeds[(k * 2) % seeds.length] % dur)) + 's';
    host.appendChild(s);
  }
}

window.mountScrollWorld = mountScrollWorld;
