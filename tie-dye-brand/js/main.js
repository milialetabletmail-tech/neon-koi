/* ============================================================
   TIE-DYE BRAND — Phase 1: Preloader + "Color Burst" Hero
   ============================================================ */

(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------
     Split the headline into per-character spans for a stagger-in
     reveal. Done manually so we don't pull in the paid SplitText
     plugin for one headline.
     ------------------------------------------------------------ */
  function splitHeadline(el) {
    const lines = el.querySelectorAll('.line');
    const chars = [];
    lines.forEach((line) => {
      const text = line.textContent;
      line.textContent = '';
      [...text].forEach((ch) => {
        const span = document.createElement('span');
        span.className = 'char';
        span.textContent = ch === ' ' ? ' ' : ch;
        line.appendChild(span);
        chars.push(span);
      });
    });
    return chars;
  }

  /* ------------------------------------------------------------
     Preloader — plays a short dye-wipe, holds for a minimum
     visible duration, then releases the page and hands off to
     the scroll build below.
     ------------------------------------------------------------ */
  function runPreloader(onComplete) {
    const preloader = document.getElementById('preloader');
    const wipe = preloader.querySelector('.preloader-wipe');
    const mark = preloader.querySelector('.preloader-mark');

    const MIN_VISIBLE_MS = 900;
    const shownAt = performance.now();

    function release() {
      const elapsed = performance.now() - shownAt;
      const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);
      window.setTimeout(() => {
        const tl = gsap.timeline({
          onComplete: () => {
            preloader.remove();
            document.body.classList.remove('preloading');
            onComplete();
          },
        });
        tl.to(mark, { opacity: 0, duration: 0.25, ease: 'power1.in' }, 0)
          .to(wipe, { clipPath: 'circle(150% at 50% 50%)', duration: 0.7, ease: 'power4.inOut' }, 0)
          .to(preloader, { opacity: 0, duration: 0.3, ease: 'power1.in' }, '-=0.15');
      }, wait);
    }

    if (prefersReducedMotion) {
      gsap.set(wipe, { clipPath: 'circle(150% at 50% 50%)' });
      gsap.set(mark, { opacity: 1 });
      window.addEventListener('load', release, { once: true });
      if (document.readyState === 'complete') release();
      return;
    }

    gsap.set(wipe, { clipPath: 'circle(0% at 50% 50%)' });
    gsap.to(mark, { opacity: 1, duration: 0.4, ease: 'power1.out' });

    window.addEventListener('load', release, { once: true });
    if (document.readyState === 'complete') release();
  }

  /* ------------------------------------------------------------
     Color Burst — pinned, scroll-scrubbed hero sequence.
     ------------------------------------------------------------ */
  function buildColorBurst() {
    const stage = document.querySelector('.colorburst-stage');
    const bg = document.querySelector('.colorburst-bg');
    const blobs = {
      pink: document.querySelector('[data-blob="pink"]'),
      blue: document.querySelector('[data-blob="blue"]'),
      orange: document.querySelector('[data-blob="orange"]'),
    };
    const dyeBlobs = {
      pink: document.querySelector('[data-dye="pink"]'),
      blue: document.querySelector('[data-dye="blue"]'),
      orange: document.querySelector('[data-dye="orange"]'),
    };
    const garmentStage = document.querySelector('.garment-stage');
    const headlineChars = splitHeadline(document.querySelector('[data-split]'));
    const label = document.querySelector('.colorburst-label');
    const batch = document.querySelector('.colorburst-batch');

    if (prefersReducedMotion) {
      // CSS handles the static reveal state; nothing to animate.
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    // Ambient blobs: off-canvas, converging toward the stage center.
    gsap.set(blobs.pink,   { x: '-55vw', y: '-28vh', scale: 0.6, opacity: 0 });
    gsap.set(blobs.blue,   { x: '50vw',  y: '-32vh', scale: 0.6, opacity: 0 });
    gsap.set(blobs.orange, { x: '10vw',  y: '50vh',  scale: 0.7, opacity: 0 });

    // Dye blobs: contained within the garment box, so the gooey filter's
    // effect region (and the mask it sits under) never has to clip them.
    // "Soaking growth" comes from scaling these up, not a separate mask.
    gsap.set(dyeBlobs.pink,   { xPercent: -50, yPercent: -50, x: '-14%', y: '-18%', scale: 0.2, opacity: 0 });
    gsap.set(dyeBlobs.blue,   { xPercent: -50, yPercent: -50, x: '16%',  y: '-10%', scale: 0.2, opacity: 0 });
    gsap.set(dyeBlobs.orange, { xPercent: -50, yPercent: -50, x: '2%',   y: '20%',  scale: 0.22, opacity: 0 });

    gsap.set(garmentStage, { scale: 1, rotate: 0, transformOrigin: '50% 50%' });

    const tl = gsap.timeline({
      defaults: { ease: 'power2.out' },
      scrollTrigger: {
        trigger: '.colorburst',
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1,
        pin: stage,
        anticipatePin: 1,
      },
    });

    // --- State 0 -> 1 (0% - 15%): quiet hold, undyed garment ---
    tl.addLabel('undyed', 0);

    // --- State 1 (15% - 45%): burst — blobs race in, dye starts pooling ---
    tl.addLabel('burst', 0.15);
    tl.to(bg, { opacity: 0.22, scale: 1, filter: 'blur(130px) saturate(0.85)', duration: 0.3, ease: 'sine.out' }, 'burst');
    tl.to(blobs.pink,   { x: '-8vw', y: '-6vh', scale: 1, opacity: 0.8, duration: 0.28, ease: 'power2.out' }, 'burst');
    tl.to(blobs.blue,   { x: '9vw',  y: '-4vh', scale: 1, opacity: 0.8, duration: 0.28, ease: 'power2.out' }, 'burst+=0.03');
    tl.to(blobs.orange, { x: '0vw',  y: '8vh',  scale: 1, opacity: 0.75, duration: 0.28, ease: 'power2.out' }, 'burst+=0.05');
    tl.to(dyeBlobs.pink,   { x: '-8%', y: '-10%', scale: 1, opacity: 0.95, duration: 0.3, ease: 'sine.inOut' }, 'burst+=0.05');
    tl.to(dyeBlobs.blue,   { x: '9%',  y: '-4%',  scale: 1, opacity: 0.95, duration: 0.3, ease: 'sine.inOut' }, 'burst+=0.08');
    tl.to(dyeBlobs.orange, { x: '0%',  y: '10%',  scale: 1.05, opacity: 0.95, duration: 0.3, ease: 'sine.inOut' }, 'burst+=0.1');

    // --- State 2 (45% - 70%): saturate + text assembles ---
    // Each dye blob grows large enough for full garment coverage, but stays
    // anchored over its own region (chest-left / shoulder-right / hem)
    // rather than converging on the same spot — if all three stack on top
    // of each other, the blur has no nearby edge left to mix across and the
    // top-painted color just flatly covers the rest. Keeping them spread
    // out means their blurred borders keep meeting (and mixing) even at
    // full coverage, which is what actually reads as tie-dye.
    tl.addLabel('saturate', 0.45);
    tl.to(dyeBlobs.pink,   { scale: 1.35, x: '-24%', y: '-22%', opacity: 0.88, duration: 0.22, ease: 'sine.inOut' }, 'saturate');
    tl.to(dyeBlobs.blue,   { scale: 1.35, x: '25%',  y: '-14%', opacity: 0.88, duration: 0.22, ease: 'sine.inOut' }, 'saturate+=0.02');
    tl.to(dyeBlobs.orange, { scale: 1.5,  x: '0%',   y: '26%',  opacity: 0.88, duration: 0.22, ease: 'sine.inOut' }, 'saturate+=0.04');
    tl.to([blobs.pink, blobs.blue, blobs.orange], { opacity: 0, scale: 1.3, duration: 0.22, ease: 'sine.in' }, 'saturate');
    tl.to(bg, { opacity: 0.32, filter: 'blur(140px) saturate(0.95)', duration: 0.25 }, 'saturate');
    tl.to(label, { opacity: 0, y: -10, duration: 0.12 }, 'saturate');
    tl.to(headlineChars, {
      opacity: 1,
      y: 0,
      rotate: 0,
      duration: 0.3,
      stagger: { each: 0.012, from: 'center' },
    }, 'saturate+=0.02');
    tl.to(batch, { opacity: 0.9, y: 0, duration: 0.2 }, 'saturate+=0.15');

    // --- State 3 (70% - 100%): release into next section ---
    tl.addLabel('release', 0.7);
    tl.to(garmentStage, { scale: 0.92, rotate: -2, duration: 0.3 }, 'release');
    tl.to(bg, { opacity: 0.16, scale: 1.15, duration: 0.3 }, 'release');
    tl.to([headlineChars, batch], { opacity: 0, duration: 0.2 }, 'release+=0.1');

    /* --- subtle mouse-parallax on garment, state0 only --- */
    const tiltX = gsap.quickTo(garmentStage, 'rotateY', { duration: 0.6, ease: 'power2.out' });
    const tiltY = gsap.quickTo(garmentStage, 'rotateX', { duration: 0.6, ease: 'power2.out' });
    let parallaxActive = true;

    ScrollTrigger.create({
      trigger: '.colorburst',
      start: 'top top',
      end: '+=15%',
      onUpdate: (self) => { parallaxActive = self.progress <= 0; },
    });

    window.addEventListener('mousemove', (e) => {
      if (!parallaxActive) return;
      const relX = (e.clientX / window.innerWidth) - 0.5;
      const relY = (e.clientY / window.innerHeight) - 0.5;
      tiltX(relX * 6);
      tiltY(relY * -6);
    });
  }

  /* ------------------------------------------------------------
     Boot
     ------------------------------------------------------------ */
  document.addEventListener('DOMContentLoaded', () => {
    runPreloader(() => {
      buildColorBurst();
      if (window.ScrollTrigger) ScrollTrigger.refresh();
    });
  });
})();
