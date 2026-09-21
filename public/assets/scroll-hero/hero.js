(()=>{
const summitJourney = {
  brand: { name: 'SUMMIT', href: '#home-world' },
  nav: true, atmosphere: false, crossfade: 0.06, contained: true,
  hint: 'Scroll to step inside',
  sections: [
    { id: 'light', label: '01 — Light', still: '/assets/scroll-hero/light-clean-poster.jpg', clip: '/assets/scroll-hero/light-hq-v3-scrub.mp4', clipPortrait: '/assets/scroll-hero/light-hq-v3-portrait.mp4', scroll: 2.4, linger: 0.18,
      accent: '#CC5F28', eyebrow: 'Home additions & ADUs · Denver Metro', title: 'More space.\nRight where you live.', body: 'Create room for family, independence, and whatever comes next.' },
    { id: 'detail', label: '02 — Detail', still: '/assets/scroll-hero/detail-clear-v2-still.png', poster: '/assets/scroll-hero/detail-clear-v2-poster.png', clip: '/assets/scroll-hero/detail-hq-v3-scrub.mp4', clipPortrait: '/assets/scroll-hero/detail-hq-v3-portrait.mp4', scroll: 1.6, linger: 0.12,
      accent: '#CC5F28', eyebrow: 'Built for the way you live', title: 'New space.\nThoughtfully connected.', body: 'From structure and utilities to the details that make the space feel like home.' },
    { id: 'retreat', label: '03 — Retreat', still: '/assets/scroll-hero/retreat-repaired-v2-still.png', poster: '/assets/scroll-hero/retreat-repaired-v2-poster.png', clip: '/assets/scroll-hero/retreat-hq-v3-scrub.mp4', clipPortrait: '/assets/scroll-hero/retreat-hq-v3-portrait.mp4', scroll: 1.8, linger: 0.22,
      accent: '#CC5F28', eyebrow: 'Your next chapter starts here', title: 'Addition or ADU.\nLet’s plan it well.', body: 'Start with your property, the people you are making room for, and what the space needs to do.',
      cta: { primary: { label: 'Plan your addition or ADU ↗', href: '/contact-contractor-renovations-in-denver-lakewood-arvada-morrison-wheat-ridge-golden-co/' } } }
  ], connectors: []
};
const root = document.getElementById('home-world');
const fallback = root.querySelector('.hero-fallback');
const staticHeading = fallback.querySelector('h1');
mountScrollWorld(root, summitJourney);
root.querySelector('.sw-viewport').append(root.querySelector('.editorial-note'),root.querySelector('.always-cta'));
const heading = root.querySelector('.sw-copy__title');
staticHeading.className = heading.className; staticHeading.textContent = heading.textContent; heading.replaceWith(staticHeading);
fallback.remove();
const brandLogo = document.createElement('img');
brandLogo.className = 'summit-logo';
brandLogo.src = '/assets/scroll-hero/summit-custom-builders-logo.png';
brandLogo.alt = 'Summit Custom Builders';
brandLogo.width = 5001; brandLogo.height = 4663;
brandLogo.decoding = 'async';
root.querySelector('.sw-brand').replaceChildren(brandLogo);
root.querySelector('.sw-brand').setAttribute('aria-label','Summit Custom Builders — return to start');
root.querySelector('.sw-nav').setAttribute('aria-label','Journey chapters');
root.querySelector('.sw-brand').addEventListener('click',e=>{e.preventDefault();window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});
root.querySelectorAll('.sw-scene__still').forEach((img,i)=>{img.alt=['White Shaker kitchen with a quartz island and skylight','Teal vanity with brass fittings and arched mirrors','Sunlit white tub beside a marble and glass shower'][i];if(i===0){img.loading='eager';img.fetchPriority='high';}});

const menu = document.querySelector('.home-menu');
document.addEventListener('keydown', e => { if(e.key === 'Escape' && menu.open){ menu.open = false; menu.querySelector('summary').focus(); } });

})();
