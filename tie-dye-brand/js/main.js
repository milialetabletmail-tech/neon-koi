/* ============================================================
   TIE-DYE BRAND — Phase 1: Preloader + "Color Burst" Hero
   ============================================================ */

(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const FRAME_COUNT = 152; // frame-000.jpg .. frame-151.jpg, every native frame of the source clip
  const FRAME_PATH = (i) => `assets/video-frames/frame-${String(i).padStart(3, '0')}.jpg`;

  /* ------------------------------------------------------------
     Preload the dye-reveal frame sequence. Resolves with an array
     of loaded <img> elements ready to draw to canvas. A real
     <video> was tried here — driving currentTime off scroll — but
     native seeking is throttled/keyframe-limited and gets visibly
     janky under fast, repeated scroll-driven seeks, even with a
     short GOP. Drawing pre-decoded frames to canvas has no seek
     step at all: each scroll update just picks the two nearest
     already-loaded images and draws them, so it's exactly as smooth
     as the browser's paint loop allows.
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
    const garmentStage = document.querySelector('.garment-stage');
    const canvas = document.querySelector('.dye-canvas');
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const wordmarkGlow = document.querySelector('.hero-wordmark-glow');
    const wordmark = document.querySelector('.hero-wordmark');
    const subhead = document.querySelector('.hero-subhead');
    const label = document.querySelector('.colorburst-label');
    const batch = document.querySelector('.colorburst-batch');
    const hint = document.querySelector('.scroll-hint');

    const lastFrame = FRAME_COUNT - 1;

    // Cross-fades between the two nearest frames instead of snapping to the
    // nearest whole frame — at typical scroll speeds a hard frame-to-frame
    // cut can still read as a stepped flipbook even at 152 frames. Blending
    // on the fractional part of the scrub position doubles the perceived
    // smoothness for free, no extra frames needed.
    function drawFrame(index) {
      const clamped = Math.max(0, Math.min(lastFrame, index));
      const floor = Math.floor(clamped);
      const ceil = Math.min(lastFrame, floor + 1);
      const t = clamped - floor;

      const imgA = frames[floor];
      const imgB = frames[ceil];
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (imgA && imgA.complete && imgA.naturalWidth) {
        ctx.globalAlpha = 1;
        ctx.drawImage(imgA, 0, 0, canvas.width, canvas.height);
      }
      if (ceil !== floor && t > 0.001 && imgB && imgB.complete && imgB.naturalWidth) {
        ctx.globalAlpha = t;
        ctx.drawImage(imgB, 0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
      }
    }

    drawFrame(0);

    function hideScrollHint() {
      if (!hint || hint.dataset.hidden) return;
      hint.dataset.hidden = 'true';
      gsap.to(hint, {
        opacity: 0,
        y: 8,
        duration: 0.4,
        ease: 'power1.in',
        onComplete: () => hint.remove(),
      });
    }

    if (prefersReducedMotion) {
      drawFrame(lastFrame); // land straight on the finished tie-dye
      if (hint) hint.remove();
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
        onUpdate: (self) => {
          if (self.progress > 0.004) hideScrollHint();
        },
      },
    });

    const st = tl.scrollTrigger;

    // --- Tap/click-to-advance: lets someone unfold the tee by tapping the
    // screen instead of scrolling — useful on trackpad-less phones and just
    // a nicer way to "play" with the effect. A native smooth-scroll (not a
    // GSAP tween) is enough here since ScrollTrigger's scrub already reacts
    // to any change in scroll position, whatever caused it. Using the
    // 'click' event (not 'touchstart') is deliberate: browsers only fire a
    // synthetic click for a genuine tap, not for a scroll/swipe drag, so
    // this never fights normal touch scrolling. ---
    function spawnTapRipple(clientX, clientY) {
      const rect = stage.getBoundingClientRect();
      const ripple = document.createElement('div');
      ripple.className = 'tap-ripple';
      ripple.style.left = `${clientX - rect.left}px`;
      ripple.style.top = `${clientY - rect.top}px`;
      stage.appendChild(ripple);
      gsap.fromTo(
        ripple,
        { scale: 0, opacity: 0.7 },
        {
          scale: 1,
          opacity: 0,
          duration: 0.65,
          ease: 'power2.out',
          onComplete: () => ripple.remove(),
        }
      );
    }

    stage.addEventListener('click', (evt) => {
      const progress = st.progress;
      const target = progress >= 0.97 ? 0 : progress + 0.16;
      const dest = st.start + (st.end - st.start) * gsap.utils.clamp(0, 1, target);
      window.scrollTo({ top: dest, behavior: 'smooth' });
      spawnTapRipple(evt.clientX, evt.clientY);
      hideScrollHint();
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

    // --- State 2 (45% - 70%): text assembles as the tee finishes dyeing ---
    tl.addLabel('saturate', 0.45);
    tl.to(label, { opacity: 0, y: -10, duration: 0.12 }, 'saturate');
    tl.to(wordmarkGlow, { opacity: 1, duration: 0.3, ease: 'sine.out' }, 'saturate');
    tl.to(subhead, { opacity: 0.85, duration: 0.2, ease: 'sine.out' }, 'saturate');
    // The wordmark lands as one unified "stamp" (scale + fade), not a
    // per-letter stagger — a short logotype reads as a mark, not a
    // sentence, and this also sidesteps a real bug the stagger version
    // had: splitting the word into child <span> letters broke the mask-
    // fill effect, since only the element that owns the mask can clip to
    // its own glyphs.
    tl.to(wordmark, {
      opacity: 1,
      scale: 1,
      duration: 0.22,
      ease: 'back.out(1.6)',
    }, 'saturate+=0.03');
    tl.to(batch, { opacity: 0.9, y: 0, duration: 0.2 }, 'saturate+=0.15');

    // Nothing after this: once the wordmark and batch line finish landing,
    // the scroll simply stops driving anything further. There used to be
    // a "release" state here — the garment shrinking and the text fading
    // back out — but that made the wordmark's appearance feel like a
    // fleeting mid-point instead of the payoff. Deleting those tweens
    // (rather than just, say, setting their end values to a no-op) also
    // shortens the timeline's own total duration to match, which
    // ScrollTrigger's scrub picks up automatically: the last real tween
    // (the batch line) now lands exactly at 100% scroll instead of 80%,
    // so there's no dead scroll room after everything's on screen either.
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
