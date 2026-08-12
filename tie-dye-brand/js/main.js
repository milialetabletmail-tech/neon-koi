/* ============================================================
   TIE-DYE BRAND — Phase 1: Preloader + "Color Burst" Hero
   ============================================================ */

(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const FRAME_COUNT = 121; // frame-000.jpg .. frame-120.jpg
  const FRAME_PATH = (i) => `assets/video-frames/frame-${String(i).padStart(3, '0')}.jpg`;

  /* ------------------------------------------------------------
     Preload the dye-reveal frame sequence. Resolves with an array
     of loaded <img> elements ready to draw to canvas — native
     video.currentTime scrubbing is throttled/keyframe-limited and
     gets janky under fast scroll-driven seeks, so the reveal is
     driven as pre-decoded frames instead.
     ------------------------------------------------------------ */
  function loadFrames() {
    const frames = new Array(FRAME_COUNT);
    const loads = [];
    for (let i = 0; i < FRAME_COUNT; i++) {
      loads.push(new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve(); // don't block the page on one bad frame
        img.src = FRAME_PATH(i);
        frames[i] = img;
      }));
    }
    return Promise.all(loads).then(() => frames);
  }

  /* ------------------------------------------------------------
     Preloader — plays a short dye-wipe, holds for a minimum
     visible duration (and until the frame sequence is ready),
     then releases the page and hands off to the scroll build.
     ------------------------------------------------------------ */
  function runPreloader(framesPromise, onComplete) {
    const preloader = document.getElementById('preloader');
    const wipe = preloader.querySelector('.preloader-wipe');
    const mark = preloader.querySelector('.preloader-mark');

    const MIN_VISIBLE_MS = 900;
    const shownAt = performance.now();

    function startWipe() {
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
    }

    function release() {
      const elapsed = performance.now() - shownAt;
      const minWait = Math.max(0, MIN_VISIBLE_MS - elapsed);
      Promise.all([
        new Promise((resolve) => window.setTimeout(resolve, minWait)),
        framesPromise,
      ]).then(startWipe);
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
  function buildColorBurst(frames) {
    const stage = document.querySelector('.colorburst-stage');
    const bg = document.querySelector('.colorburst-bg');
    const garmentStage = document.querySelector('.garment-stage');
    const canvas = document.querySelector('.dye-canvas');
    const ctx = canvas.getContext('2d');
    const wordmark = document.querySelector('.hero-wordmark');
    const subhead = document.querySelector('.hero-subhead');
    const label = document.querySelector('.colorburst-label');
    const batch = document.querySelector('.colorburst-batch');

    const lastFrame = FRAME_COUNT - 1;

    function drawFrame(index) {
      const clamped = Math.max(0, Math.min(lastFrame, Math.round(index)));
      const img = frames[clamped];
      if (!img || !img.complete || img.naturalWidth === 0) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }

    drawFrame(0);

    if (prefersReducedMotion) {
      drawFrame(lastFrame); // land straight on the finished tie-dye
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    gsap.set(garmentStage, { scale: 1 });

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

    // --- State 0 (0% - 8%): quiet hold, undyed tee (frame 0) ---
    tl.addLabel('undyed', 0);

    // --- Frame scrub (8% - 68%): the filmed splash -> spiral sequence,
    // linearly scrubbed against scroll so it feels physically tied to the
    // scrollbar rather than autoplaying. ---
    const frameProxy = { frame: 0 };
    tl.to(frameProxy, {
      frame: lastFrame,
      duration: 0.6,
      ease: 'none',
      onUpdate: () => drawFrame(frameProxy.frame),
    }, 0.08);

    tl.to(bg, { opacity: 0.22, scale: 1, filter: 'blur(130px) saturate(0.85)', duration: 0.3, ease: 'sine.out' }, 0.12);

    // --- State 2 (45% - 70%): text assembles as the tee finishes dyeing ---
    tl.addLabel('saturate', 0.45);
    tl.to(bg, { opacity: 0.32, filter: 'blur(140px) saturate(0.95)', duration: 0.25 }, 'saturate');
    tl.to(label, { opacity: 0, y: -10, duration: 0.12 }, 'saturate');
    tl.to(subhead, { opacity: 0.85, duration: 0.2, ease: 'sine.out' }, 'saturate');
    // SMN lands as one unified "stamp" (scale + fade), not a per-letter
    // stagger — a 3-letter logotype reads as a mark, not a sentence, and
    // this also sidesteps a real bug the stagger version had: splitting
    // the word into child <span> letters broke the gradient background-
    // clip:text effect, since only the element that owns the background
    // can clip to its own glyphs.
    tl.to(wordmark, {
      opacity: 1,
      scale: 1,
      duration: 0.22,
      ease: 'back.out(1.6)',
    }, 'saturate+=0.03');
    tl.to(batch, { opacity: 0.9, y: 0, duration: 0.2 }, 'saturate+=0.15');

    // --- State 3 (70% - 100%): release into next section ---
    // Scale only — no rotate/tilt anywhere on the garment stage or canvas,
    // the footage box stays perfectly flat throughout the whole scroll.
    tl.addLabel('release', 0.7);
    tl.to(garmentStage, { scale: 0.92, duration: 0.3 }, 'release');
    tl.to(bg, { opacity: 0.16, scale: 1.15, duration: 0.3 }, 'release');
    tl.to([wordmark, subhead, batch], { opacity: 0, duration: 0.2 }, 'release+=0.1');
  }

  /* ------------------------------------------------------------
     Boot
     ------------------------------------------------------------ */
  document.addEventListener('DOMContentLoaded', () => {
    const framesPromise = loadFrames();
    runPreloader(framesPromise, () => {
      framesPromise.then((frames) => {
        buildColorBurst(frames);
        if (window.ScrollTrigger) ScrollTrigger.refresh();
      });
    });
  });
})();
