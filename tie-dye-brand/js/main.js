/* ============================================================
   TIE-DYE BRAND — Phase 1: Preloader + "Color Burst" Hero
   ============================================================ */

(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------
     Preload the dye-reveal video. Resolves once enough of it has
     downloaded to seek freely — 'loadeddata' guarantees duration
     and the first frame are available, and the file is small
     enough (~5MB) that it's realistically all in flight by then.
     ------------------------------------------------------------ */
  function loadVideo(video) {
    return new Promise((resolve) => {
      if (video.readyState >= 2) { resolve(); return; } // HAVE_CURRENT_DATA
      video.addEventListener('loadeddata', () => resolve(), { once: true });
      video.addEventListener('error', () => resolve(), { once: true }); // don't block the page
      video.load();
    });
  }

  /* ------------------------------------------------------------
     Preloader — plays a short dye-wipe, holds for a minimum
     visible duration (and until the video is ready), then
     releases the page and hands off to the scroll build.
     ------------------------------------------------------------ */
  function runPreloader(videoPromise, onComplete) {
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
        videoPromise,
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
  function buildColorBurst(video) {
    const stage = document.querySelector('.colorburst-stage');
    const garmentStage = document.querySelector('.garment-stage');
    const wordmarkGlow = document.querySelector('.hero-wordmark-glow');
    const wordmark = document.querySelector('.hero-wordmark');
    const subhead = document.querySelector('.hero-subhead');
    const label = document.querySelector('.colorburst-label');
    const batch = document.querySelector('.colorburst-batch');
    const hint = document.querySelector('.scroll-hint');

    // Video never plays on its own — currentTime is driven entirely by
    // scroll position below, so pause it in case autoplay heuristics
    // start it and clamp seeks to a valid, known duration.
    video.pause();
    const rawDuration = video.duration && isFinite(video.duration) ? video.duration : 0;
    // Stop just short of the true end: seeking to the exact duration lands
    // past the last decodable frame in some browsers and shows a blank one.
    const duration = Math.max(0, rawDuration - 0.05);

    function seekTo(time) {
      const clamped = Math.max(0, Math.min(duration, time));
      // Assigning currentTime is itself the seek; guard against redundant
      // assignments firing spurious 'seeking' work on some browsers.
      if (Math.abs(video.currentTime - clamped) > 0.001) video.currentTime = clamped;
    }

    seekTo(0);

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
      seekTo(duration); // land straight on the finished tie-dye
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

    // --- Video scrub (8% - 68%): the filmed splash -> spiral sequence,
    // linearly scrubbed against scroll so it feels physically tied to the
    // scrollbar rather than autoplaying. ---
    const scrubProxy = { time: 0 };
    tl.to(scrubProxy, {
      time: duration,
      duration: 0.6,
      ease: 'none',
      onUpdate: () => seekTo(scrubProxy.time),
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

    // --- State 3 (70% - 100%): release into next section ---
    // Scale only — no rotate/tilt anywhere on the garment stage or video,
    // the footage box stays perfectly flat throughout the whole scroll.
    tl.addLabel('release', 0.7);
    tl.to(garmentStage, { scale: 0.92, duration: 0.3 }, 'release');
    tl.to([wordmark, subhead, batch, wordmarkGlow], { opacity: 0, duration: 0.2 }, 'release+=0.1');
  }

  /* ------------------------------------------------------------
     Boot
     ------------------------------------------------------------ */
  document.addEventListener('DOMContentLoaded', () => {
    const video = document.querySelector('.dye-video');
    const videoPromise = loadVideo(video);
    runPreloader(videoPromise, () => {
      videoPromise.then(() => {
        buildColorBurst(video);
        if (window.ScrollTrigger) ScrollTrigger.refresh();
      });
    });
  });
})();
