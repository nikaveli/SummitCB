/* Summit section choreography. Self-hosted GSAP 3.13; native scrolling throughout. */
(() => {
  const { gsap, ScrollTrigger, SplitText } = window;
  const main = document.querySelector('main');
  if (!gsap || !ScrollTrigger || !main) return;
  gsap.registerPlugin(ScrollTrigger);
  if (SplitText) gsap.registerPlugin(SplitText);
  const media = gsap.matchMedia();

  media.add({ desktop: '(min-width: 801px)', mobile: '(max-width: 800px)', stage: '(min-width: 1050px) and (min-height: 700px) and (hover: hover)', reduce: '(prefers-reduced-motion: reduce)', print: 'print' }, context => {
    if (context.conditions.reduce || context.conditions.print) return;
    const compact = context.conditions.mobile;
    const staged = context.conditions.stage;
    const cleanups = [];
    const lineHeadings = new Set();
    const splitHeadings = [];
    const scope = document.querySelector('#home-content') || main;
    const all = (selector, root = scope) => [...root.querySelectorAll(selector)];
    const sequences = new Map();
    const seen = new Set();
    const distance = compact ? 14 : 30;
    let refreshTimer;

    // Content already on screen (including restored scroll positions) stays immediately readable.
    const sequence = (root, steps) => {
      if (!root || seen.has(root) || root.getBoundingClientRect().top < innerHeight * .94 || !steps.some(step => step.target && (!Array.isArray(step.target) || step.target.length))) return;
      seen.add(root);
      const timeline = gsap.timeline({
        defaults: { duration: compact ? .55 : .9, ease: 'power3.out', clearProps: 'transform,opacity,clipPath' },
        scrollTrigger: {
          trigger: root, start: 'top 92%', end: 'bottom top', once: true,
          onLeave: () => timeline.progress(1),
        },
      });
      for (const { target, from, at = 0 } of steps) {
        if (target && (!Array.isArray(target) || target.length)) timeline.from(target, from, at);
      }
      sequences.set(root, timeline);
      return timeline;
    };
    const rise = (target, at = 0, x = 0) => ({ target, from: { y: distance, x: compact ? 0 : x, opacity: .15, stagger: .075 }, at });
    const aperture = (target, reverse = false, at = 0) => ({ target, from: {
      clipPath: compact ? 'inset(5% 0% 5% 0%)' : reverse ? 'inset(0% 0% 0% 16%)' : 'inset(0% 16% 0% 0%)',
      y: compact ? 12 : 24, opacity: .4, duration: compact ? .7 : 1.2,
    }, at });

    // Only selected display headings assemble. SplitText preserves the accessible name and
    // remeasures actual lines after a width/font change; paragraphs keep ordinary markup.
    const headline = heading => {
      if (!SplitText || !heading || heading.getBoundingClientRect().top < innerHeight * .94) return;
      lineHeadings.add(heading);
      let finished = false;
      const split = SplitText.create(heading, {
        type: 'lines', mask: 'lines', linesClass: 'summit-line', autoSplit: true,
        onSplit(self) {
          if (finished) return;
          const tween = gsap.from(self.lines, {
            yPercent: 112, duration: compact ? .65 : 1, stagger: .09, ease: 'power3.out',
            onComplete: () => { finished = true; },
            scrollTrigger: { trigger: heading, start: 'top 92%', end: 'bottom top', once: true,
              onLeave: () => tween.progress(1) },
          });
          sequences.set(heading, tween);
          return tween;
        },
      });
      splitHeadings.push(split);
    };

    // Native sticky images hold for a short reading chapter. No extra pinned blank space.
    all('.service-feature').forEach(feature => {
      const reverse = feature.classList.contains('service-feature--reverse');
      const photo = feature.querySelector('.service-feature-photo');
      const copy = feature.querySelector('.service-feature-copy');
      if (staged) {
        feature.classList.add('service-chapter');
        cleanups.push(() => feature.classList.remove('service-chapter'));
        gsap.fromTo(photo.querySelector('img'), { scale: 1.09 }, {
          scale: 1, ease: 'none', scrollTrigger: {
            trigger: feature, start: 'top bottom', end: 'bottom 70%', scrub: .65,
          },
        });
        gsap.fromTo(photo.querySelector('.photo'), {
          clipPath: reverse ? 'inset(7% 0% 7% 9%)' : 'inset(7% 9% 7% 0%)',
        }, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none', scrollTrigger: {
          trigger: feature, start: 'top 95%', end: 'top 24%', scrub: .4,
        }});
        headline(copy.querySelector('h2'));
        [...copy.children].filter(el => !el.matches('h2')).forEach(el => {
          sequence(el, [rise(el, 0, reverse ? -22 : 22)]);
        });
      } else {
        headline(copy.querySelector('h2'));
        sequence(photo, [aperture(photo, reverse)]);
        [...copy.children].filter(el => !lineHeadings.has(el)).forEach(el => sequence(el, [rise(el)]));
      }
    });

    // A construction edge reveals the next photograph as its written stage arrives.
    // All five figures remain in normal flow unless this desktop enhancement is active.
    const processLayout = scope.querySelector('.process-visual-layout');
    if (processLayout && staged) {
      processLayout.classList.add('process-story');
      cleanups.push(() => processLayout.classList.remove('process-story'));
      const frames = all('.process-frame', processLayout);
      const steps = all('.process-list > li', processLayout);
      frames.forEach((frame, i) => {
        // Every stacked frame has a solid ground and a full-strength caption.
        gsap.set(frame, { zIndex: i + 1 });
        if (!i) return;
        gsap.fromTo(frame, { clipPath: 'inset(100% 0% 0% 0%)' }, {
          clipPath: 'inset(0% 0% 0% 0%)', ease: 'none',
          scrollTrigger: { id: `process-frame-${i}`, trigger: steps[i], start: 'top 78%', end: 'top 43%', scrub: .4 },
        });
      });
      steps.forEach((step, i) => {
        ScrollTrigger.create({ trigger: step, start: 'top 55%', end: 'bottom 55%',
          toggleClass: { targets: step, className: 'process-step-current' } });
        cleanups.push(() => step.classList.remove('process-step-current'));
      });
    }

    // One bounded lateral passage in the lower project gallery. The normal photo gallery
    // and its filters are untouched. Mobile/reduced motion use the original six-photo grid.
    const showcase = scope.querySelector('.project-showcase');
    if (showcase && staged) {
      const stage = showcase.querySelector('.showcase-stage');
      const rail = showcase.querySelector('.gallery-updated');
      showcase.classList.add('showcase-pan');
      const travel = () => Math.max(0, rail.scrollWidth - stage.clientWidth);
      if (travel() > stage.clientWidth * .5) {
        // Decode upcoming stills before the rail arrives; horizontal transforms do not
        // consistently prompt lazy-image loading in every browser.
        const preload = new IntersectionObserver(entries => {
          if (!entries.some(entry => entry.isIntersecting)) return;
          all('img', rail).forEach(img => { img.loading = 'eager'; });
          preload.disconnect();
        }, { rootMargin: '1200px' });
        preload.observe(showcase);
        cleanups.push(() => preload.disconnect());
        gsap.to(rail, { x: () => -travel(), ease: 'none', scrollTrigger: {
          id: 'project-showcase', trigger: stage, start: 'top 8%', end: () => `+=${travel()}`,
          pin: true, scrub: .6, invalidateOnRefresh: true, anticipatePin: 1, refreshPriority: 1,
        }});
      } else showcase.classList.remove('showcase-pan');
      cleanups.push(() => showcase.classList.remove('showcase-pan'));
    }

    all('.section-heading, .section > h2').forEach((heading, i) => {
      // A moving rail has one stable title throughout the passage.
      if (heading.closest('.showcase-pan')) return;
      const title = heading.matches('h2') ? heading : heading.querySelector('h2');
      if (i % 2 === 0) headline(title);
      const parts = all(':scope > p, :scope > div > p', heading);
      if (title && !lineHeadings.has(title)) parts.unshift(title);
      sequence(heading, [rise(parts, 0, i % 2 ? 18 : -18)]);
    });
    all('.contact-band h2').forEach(headline);

    // Each row has its own cue, so long galleries never reveal their entire grid at once.
    all('.card-grid:not(.resource-grid), .service-secondary-grid, .photo-gallery, .gallery-updated, .detail-pair, .area-photo-pair').forEach(grid => {
      if (grid.closest('.showcase-pan')) return;
      const children = [...grid.children];
      const rowTops = [...new Set(children.map(el => el.offsetTop))];
      children.forEach((item, i) => {
        const row = rowTops.indexOf(item.offsetTop);
        const column = children.filter(el => el.offsetTop === item.offsetTop).indexOf(item);
        // Alternate still rows and choreographed rows; wide gallery images get a full reveal.
        const wide = item.offsetWidth > grid.clientWidth * .8;
        if (row % 2 && !wide && !grid.matches('.detail-pair, .area-photo-pair')) return;
        const photo = item.querySelector('.gallery-link, :scope > .photo');
        sequence(item, photo ? [aperture(photo, i % 2 === 1, compact ? 0 : column * .08), rise(item.querySelector('figcaption'), .2)] : [rise(item, compact ? 0 : column * .09)]);
      });
    });

    // Reading pages retain a calm cadence: every other passage gets a small, grouped entrance.
    all('.prose-section').forEach((section, i) => {
      if (i % 2 === 0) sequence(section, [rise(all(':scope > h2', section)), rise(all(':scope > :not(h2)', section), .09)]);
    });
    all('.article-photo, .process-photos > .photo-figure').forEach((figure, i) => {
      const photo = figure.querySelector('.photo');
      sequence(figure, [aperture(photo, i % 2 === 1), rise(figure.querySelector('figcaption'), .22)]);
      if (!compact && photo) {
        photo.classList.add('scroll-photo-window');
        const img = photo.querySelector('img');
        gsap.fromTo(img, { scale: 1.045, yPercent: -1.4 }, {
          scale: 1.045, yPercent: 1.4, ease: 'none',
          scrollTrigger: { trigger: figure, start: 'top bottom', end: 'bottom top', scrub: .7 },
        });
      }
    });
    all('.motion-inline').forEach(figure => {
      // Move the framed player as a unit; controls and video playback remain independent.
      sequence(figure, [rise(figure)]);
    });
    all('.local-feature').forEach(section => sequence(section, [
      rise(section.firstElementChild, 0, -24), rise(all('.city-list > a', section), .16, 24),
    ]));
    all('.contact-band').forEach(section => sequence(section, [
      rise(all(':scope > div:first-child > *', section).filter(el => !lineHeadings.has(el)), 0, -18),
      rise(section.lastElementChild, .25, 22),
    ]));
    all('.article-next, .planning-checklist').forEach(section => sequence(section, [rise([...section.children])]));

    const process = scope.querySelector('.process-list');
    if (process) {
      process.classList.add('scroll-process');
      gsap.fromTo(process, { '--process-progress': 0 }, {
        '--process-progress': 1, ease: 'none',
        scrollTrigger: { trigger: process, start: 'top 65%', end: 'bottom 65%', scrub: .35 },
      });
      all(':scope > li', process).forEach(step => sequence(step, [
        rise(step.querySelector('.step-number')), rise(all(':scope > div > *', step), .1, 18),
      ]));
    }

    const finishWithin = root => {
      for (const [element, timeline] of sequences) {
        if (root.contains(element) || element.contains(root)) {
          timeline.progress(1);
          timeline.scrollTrigger?.kill();
        }
      }
    };
    // A keyboard user or in-page link never has to wait for an entrance animation.
    const focus = event => {
      finishWithin(event.target);
      for (const heading of lineHeadings) {
        if (event.target.closest('.contact-band, .service-feature')?.contains(heading)) sequences.get(heading)?.progress(1);
      }
    };
    const anchor = () => {
      let target;
      try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch { return; }
      if (target) finishWithin(target);
    };
    const refresh = () => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => ScrollTrigger.refresh(true), 120);
    };
    const layoutChanged = event => {
      // Filters rearrange existing elements: finish those entrances before measuring new positions.
      if (event.detail?.root) finishWithin(event.detail.root);
      refresh();
    };
    main.addEventListener('focusin', focus);
    main.addEventListener('toggle', refresh, true);
    document.addEventListener('summit:layout-change', layoutChanged);
    window.addEventListener('hashchange', anchor);
    window.addEventListener('pageshow', refresh);
    const observer = new ResizeObserver(refresh);
    observer.observe(main);
    document.fonts?.ready.then(() => { if (!context.isReverted) refresh(); });
    anchor();
    ScrollTrigger.sort();
    ScrollTrigger.refresh();
    return () => {
      clearTimeout(refreshTimer);
      observer.disconnect();
      main.removeEventListener('focusin', focus);
      main.removeEventListener('toggle', refresh, true);
      document.removeEventListener('summit:layout-change', layoutChanged);
      window.removeEventListener('hashchange', anchor);
      window.removeEventListener('pageshow', refresh);
      for (const cleanup of cleanups) cleanup();
      for (const split of splitHeadings) split.revert();
      process?.classList.remove('scroll-process');
      all('.scroll-photo-window').forEach(photo => photo.classList.remove('scroll-photo-window'));
    };
  });
})();
