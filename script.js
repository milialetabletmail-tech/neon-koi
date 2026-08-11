/* ==========================================================================
   NEON KOI — shared interactivity: ambient audio engine, click SFX,
   mobile nav, menu tabs, cocktail map, and form handling.
   ========================================================================== */

(function () {
  "use strict";

  /* ---------------------------------------------------------------------
     Audio Engine (Web Audio API) — synthesized ambient pad + click SFX.
     No external audio files: everything is generated with oscillators,
     so the whole experience stays self-contained.
  --------------------------------------------------------------------- */
  const AudioEngine = (function () {
    let ctx = null;
    let masterGain, ambientGain, sfxGain;
    let ambientStarted = false;
    let ambientStartedAt = 0;
    let muted = localStorage.getItem("neonkoi-muted") === "true";
    const VOLUME = 0.5;
    // "Muted" still lets a whisper of signal through instead of true
    // silence. Some devices (Android in particular) detect a fully-silent
    // output stream and power down the audio hardware to save battery,
    // then have to spin it back up the moment real signal returns — and
    // that hardware wake-up is exactly what produces a click/pop right as
    // you unmute. Keeping the stream just barely alive avoids the
    // stop/restart entirely, and MUTE_FLOOR is well below audible.
    const MUTE_FLOOR = 0.0001;

    function ensureContext() {
      if (ctx) return;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      ctx = new Ctx();

      masterGain = ctx.createGain();
      masterGain.gain.value = muted ? MUTE_FLOOR : VOLUME;
      masterGain.connect(ctx.destination);

      ambientGain = ctx.createGain();
      ambientGain.gain.value = 0;
      ambientGain.connect(masterGain);

      sfxGain = ctx.createGain();
      sfxGain.gain.value = 0.5;
      sfxGain.connect(masterGain);
    }

    // Slowly sweeps an AudioParam back and forth like a sine LFO, but via
    // scheduled ramp keyframes instead of an audio-rate oscillator wired
    // straight into the param. Audio-rate modulation of a filter's
    // frequency forces the browser to recompute filter coefficients on
    // every single sample, which is heavy enough on weaker/mobile CPUs to
    // starve the audio thread and produce exactly the kind of random
    // click/pop/static that shows up mid-playback with no clear trigger.
    // A handful of ramp keyframes per cycle sounds identical for a sweep
    // this slow, at a fraction of the CPU cost.
    function scheduleBreathing(param, base, depth, periodSec) {
      const pointsPerCycle = 16;
      let cycleStart = ctx.currentTime;

      function scheduleCycle() {
        param.setValueAtTime(base, cycleStart);
        for (let i = 1; i <= pointsPerCycle; i++) {
          const t = cycleStart + (periodSec * i) / pointsPerCycle;
          const v = base + depth * Math.sin((2 * Math.PI * i) / pointsPerCycle);
          param.linearRampToValueAtTime(v, t);
        }
        cycleStart += periodSec;
      }

      // Keep two cycles queued up at all times so there's always slack
      // even if a setTimeout tick lands late.
      scheduleCycle();
      scheduleCycle();
      setInterval(scheduleCycle, periodSec * 500);
    }

    function startAmbient() {
      if (ambientStarted) return;
      ensureContext();
      ambientStarted = true;
      ambientStartedAt = Date.now();

      // Ease the whole ambient bed in from silence instead of snapping
      // straight to full level. Oscillators are phase-continuous at
      // start, but jumping an already-"hot" gain node onto the output the
      // instant the audio hardware stream spins up is exactly what causes
      // the audible pop/thump some browsers produce on first playback —
      // fading in gives the stream a moment to settle before it's audible.
      const rampNow = ctx.currentTime;
      ambientGain.gain.setValueAtTime(0, rampNow);
      ambientGain.gain.linearRampToValueAtTime(0.16, rampNow + 1.4);

      // Warm, clean sub-bass pad — sine waves only (no sawtooth grit,
      // no close detuning) so the low end stays smooth instead of buzzing.
      const baseFreqs = [55, 82.4]; // A1 root, E2 fifth
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 320;
      filter.Q.value = 0.4;
      filter.connect(ambientGain);
      scheduleBreathing(filter.frequency, 320, 100, 1 / 0.05);

      baseFreqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = freq;
        const oscGain = ctx.createGain();
        oscGain.gain.value = i === 0 ? 0.42 : 0.4;
        osc.connect(oscGain);
        oscGain.connect(filter);
        osc.start();
      });

      startArpeggio();
    }

    /* ---------------------------------------------------------------------
       Synthwave arpeggio — a slow, evolving neon melody layered on top of
       the deep bass drone. A gently filtered triangle lead cycles through
       a four-chord progression (Am9 – F(add9) – Cadd9 – G(add9)), run
       through a feedback delay for that classic synthwave shimmer/echo.
    --------------------------------------------------------------------- */
    function startArpeggio() {
      const arpGain = ctx.createGain();
      arpGain.gain.value = 0.15;
      arpGain.connect(ambientGain);

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 1100;
      filter.Q.value = 0.4;
      filter.connect(arpGain);

      // Slow "breathing" filter movement so the arp never feels static.
      scheduleBreathing(filter.frequency, 1100, 480, 1 / 0.035);

      // Feedback delay for a spacious, glowing echo trail.
      const delay = ctx.createDelay(1.0);
      delay.delayTime.value = 0.42;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.32;
      const delayFilter = ctx.createBiquadFilter();
      delayFilter.type = "lowpass";
      delayFilter.frequency.value = 2200;
      filter.connect(delay);
      delay.connect(delayFilter);
      delayFilter.connect(feedback);
      feedback.connect(delay);
      delay.connect(arpGain);

      const progression = [
        [220.0, 261.63, 329.63, 440.0], // Am9
        [174.61, 220.0, 261.63, 349.23], // F(add9)
        [261.63, 329.63, 392.0, 523.25], // Cadd9
        [196.0, 246.94, 293.66, 392.0], // G(add9)
      ];

      const noteLength = 0.85;
      const noteSpacing = noteLength * 0.66; // more overlap = smoother, less "stepped" legato
      let chordIndex = 0;
      let noteIndex = 0;
      let nextNoteTime = ctx.currentTime + 1.0;
      const lookahead = 60; // ms between scheduler ticks — tight enough to avoid audible gaps
      const scheduleAheadTime = 0.8; // seconds of notes queued ahead — extra slack absorbs brief main-thread stalls

      // Two alternating oscillator/gain "voices", reused for every note,
      // instead of creating a fresh pair per note forever. At this spacing
      // no more than two notes ever overlap at once, so two voices cover
      // the same legato overlap the old per-note nodes gave — without the
      // constant allocate/GC churn, which is cheap on a desktop but can be
      // enough to stall the audio thread on weaker mobile CPUs over a long
      // listening session.
      const voices = [0, 1].map(() => {
        const osc = ctx.createOscillator();
        osc.type = "triangle";
        osc.frequency.value = 220;
        const noteGain = ctx.createGain();
        noteGain.gain.value = 0;
        osc.connect(noteGain);
        noteGain.connect(filter);
        osc.start();
        return { osc, noteGain };
      });
      let voiceIndex = 0;

      function playNote(freq, time) {
        const voice = voices[voiceIndex];
        voiceIndex = (voiceIndex + 1) % voices.length;
        // The previous note on this voice has always fully decayed away
        // by the time it comes back around, so jumping frequency here is
        // silent — no audible glissando between notes.
        voice.osc.frequency.setValueAtTime(freq, time);
        voice.noteGain.gain.cancelScheduledValues(time);
        voice.noteGain.gain.setValueAtTime(0, time);
        voice.noteGain.gain.linearRampToValueAtTime(0.5, time + 0.16);
        voice.noteGain.gain.exponentialRampToValueAtTime(0.001, time + noteLength);
      }

      function scheduler() {
        // If the tab was backgrounded/throttled and a tick lands very late,
        // nextNoteTime can fall far behind ctx.currentTime. Scheduling the
        // whole overdue backlog at once would fire a burst of overlapping
        // notes all bunched together — audible as a sudden crackle/glitch.
        // Resyncing instead just picks the beat back up cleanly.
        if (nextNoteTime < ctx.currentTime - 0.5) {
          nextNoteTime = ctx.currentTime + 0.05;
        }
        while (nextNoteTime < ctx.currentTime + scheduleAheadTime) {
          const chord = progression[chordIndex];
          playNote(chord[noteIndex], nextNoteTime);
          nextNoteTime += noteSpacing;
          noteIndex++;
          if (noteIndex >= chord.length) {
            noteIndex = 0;
            chordIndex = (chordIndex + 1) % progression.length;
          }
        }
        setTimeout(scheduler, lookahead);
      }
      scheduler();
    }

    function playClick() {
      ensureContext();
      if (ctx.state === "suspended") ctx.resume();
      const now = ctx.currentTime;

      // Soft digital UI tick: two fixed-pitch tones (no frequency sweep,
      // so it never reads as a laser/gunshot "pew") with a quiet echo tail.
      const echo = ctx.createDelay(0.3);
      echo.delayTime.value = 0.085;
      const echoFeedback = ctx.createGain();
      echoFeedback.gain.value = 0.14;
      echo.connect(echoFeedback);
      echoFeedback.connect(echo);

      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = 1600;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.065, now + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

      osc.connect(gain);
      gain.connect(sfxGain);
      gain.connect(echo);
      echo.connect(sfxGain);
      osc.start(now);
      osc.stop(now + 0.06);

      // A faint upper-octave sparkle so it still feels "digital", not dull.
      const osc2 = ctx.createOscillator();
      osc2.type = "sine";
      osc2.frequency.value = 3200;
      const gain2 = ctx.createGain();
      gain2.gain.setValueAtTime(0.0001, now);
      gain2.gain.linearRampToValueAtTime(0.02, now + 0.003);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
      osc2.connect(gain2);
      gain2.connect(sfxGain);
      osc2.start(now);
      osc2.stop(now + 0.04);
    }

    function playConfirm() {
      ensureContext();
      if (ctx.state === "suspended") ctx.resume();
      const now = ctx.currentTime;
      [660, 880, 1320].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + i * 0.09);
        gain.gain.linearRampToValueAtTime(0.18, now + i * 0.09 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.4);
        osc.connect(gain);
        gain.connect(sfxGain);
        osc.start(now + i * 0.09);
        osc.stop(now + i * 0.09 + 0.42);
      });
    }

    function toggleMute() {
      ensureContext();
      muted = !muted;
      localStorage.setItem("neonkoi-muted", String(muted));
      const target = muted ? MUTE_FLOOR : VOLUME;
      const now = ctx.currentTime;
      const current = masterGain.gain.value;
      masterGain.gain.cancelScheduledValues(now);
      // Pin the param to its actual current value before ramping.
      // cancelScheduledValues() is inconsistent across browsers about
      // where it leaves an in-progress ramp — some snap back to the
      // value the ramp started from instead of where it currently is,
      // which is an instant jump (i.e. a click) rather than a ramp.
      // Anchoring explicitly removes the ambiguity.
      masterGain.gain.setValueAtTime(current, now);
      // A slower ramp than the 0.4s this used to be — some phones' audio
      // amplifiers switch power/gain stages based on signal level, and a
      // fast swing across that threshold can produce an audible click on
      // the hardware side no matter how smooth the ramp is mathematically.
      // Easing it out over a second and a half gives that much less reason
      // to trip.
      masterGain.gain.linearRampToValueAtTime(target, now + 1.5);
      return muted;
    }

    function isMuted() {
      return muted;
    }

    // True if ambient playback began within the last moment — used to tell
    // "this click's pointerdown just woke the audio up" apart from a normal
    // later click on the mute button.
    function justStarted() {
      return ambientStarted && Date.now() - ambientStartedAt < 400;
    }

    function firstInteraction() {
      ensureContext();
      if (ctx.state === "suspended") ctx.resume();
      startAmbient();
    }

    return { firstInteraction, playClick, playConfirm, toggleMute, isMuted, justStarted };
  })();

  /* ---------------------------------------------------------------------
     Boot: wire up ambient start on first gesture, mute button, and
     click SFX delegation across all interactive elements.
  --------------------------------------------------------------------- */
  function initAudioUI() {
    const soundToggle = document.querySelector("[data-sound-toggle]");
    const soundHint = document.querySelector("[data-sound-hint]");
    let hintTimers = [];

    const dismissHint = () => {
      hintTimers.forEach(clearTimeout);
      hintTimers = [];
      if (soundHint) soundHint.classList.remove("is-visible");
    };

    const startOnce = () => {
      AudioEngine.firstInteraction();
      dismissHint();
      window.removeEventListener("pointerdown", startOnce);
      window.removeEventListener("keydown", startOnce);
    };
    window.addEventListener("pointerdown", startOnce, { once: true });
    window.addEventListener("keydown", startOnce, { once: true });

    // Sound may have been left "on" from a previous page, but every fresh
    // page load still needs its own first tap before the browser will let
    // audio play — nudge the visitor instead of leaving them wondering
    // why it's silent.
    if (soundHint && !AudioEngine.isMuted()) {
      hintTimers.push(setTimeout(() => soundHint.classList.add("is-visible"), 900));
      hintTimers.push(setTimeout(dismissHint, 7000));
    }

    if (soundToggle) {
      const label = soundToggle.querySelector(".sound-label");
      const setState = (muted) => {
        soundToggle.setAttribute("data-muted", String(muted));
        soundToggle.setAttribute("aria-pressed", String(muted));
        if (label) label.textContent = muted ? "Sound Off" : "Sound On";
      };
      setState(AudioEngine.isMuted());
      soundToggle.addEventListener("click", () => {
        AudioEngine.firstInteraction();
        // The pointerdown just ahead of this click may have been the very
        // first interaction on the page, which starts the ambient track.
        // If that's what just happened, this click's job is done — don't
        // also toggle it straight to muted, or the music would start and
        // silence itself within the same tap.
        if (AudioEngine.justStarted()) {
          setState(false);
          return;
        }
        const muted = AudioEngine.toggleMute();
        setState(muted);
      });
    }

    // Click SFX on every link/button, except the mute control itself.
    document.addEventListener("click", (e) => {
      const target = e.target.closest("a, button");
      if (!target || target.hasAttribute("data-sound-toggle")) return;
      AudioEngine.playClick();
    });
  }

  /* ---------------------------------------------------------------------
     Scroll reveal — fades/slides [data-reveal] elements in once as they
     enter the viewport. No-ops on pages that don't have any.
  --------------------------------------------------------------------- */
  function initScrollReveal() {
    const targets = document.querySelectorAll("[data-reveal]");
    if (!targets.length) return;

    if (!("IntersectionObserver" in window)) {
      targets.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    targets.forEach((el) => {
      const delay = Number(el.getAttribute("data-reveal-delay")) || 0;
      el.style.transitionDelay = `${delay * 110}ms`;
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
    );
    targets.forEach((el) => observer.observe(el));
  }

  /* ---------------------------------------------------------------------
     Cursor neon glow (home page) — a soft blob that trails the pointer
     with a little lag. No-ops on touch devices or where the element
     isn't present.
  --------------------------------------------------------------------- */
  function initCursorGlow() {
    const glow = document.querySelector("[data-cursor-glow]");
    if (!glow || window.matchMedia("(hover: none)").matches) return;

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let x = targetX;
    let y = targetY;
    let active = false;
    let rafId = null;

    function tick() {
      x += (targetX - x) * 0.12;
      y += (targetY - y) * 0.12;
      glow.style.transform = `translate(${x}px, ${y}px)`;
      rafId = requestAnimationFrame(tick);
    }

    window.addEventListener("pointermove", (e) => {
      targetX = e.clientX;
      targetY = e.clientY;
      if (!active) {
        active = true;
        glow.classList.add("is-active");
        if (!rafId) tick();
      }
    });
    window.addEventListener("pointerleave", () => glow.classList.remove("is-active"));
  }

  /* ---------------------------------------------------------------------
     Mobile nav toggle
  --------------------------------------------------------------------- */
  function initNavToggle() {
    const toggle = document.querySelector("[data-nav-toggle]");
    const nav = document.querySelector("[data-main-nav]");
    if (!toggle || !nav) return;
    toggle.addEventListener("click", () => {
      nav.classList.toggle("open");
      const expanded = nav.classList.contains("open");
      toggle.setAttribute("aria-expanded", String(expanded));
    });
    nav.querySelectorAll("a").forEach((link) =>
      link.addEventListener("click", () => nav.classList.remove("open"))
    );
  }

  /* ---------------------------------------------------------------------
     Menu tabs (menu.html)
  --------------------------------------------------------------------- */
  function initMenuTabs() {
    const tabs = document.querySelectorAll("[data-menu-tab]");
    const categories = document.querySelectorAll("[data-menu-category]");
    if (!tabs.length) return;
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const target = tab.getAttribute("data-menu-tab");
        tabs.forEach((t) => t.classList.toggle("active", t === tab));
        categories.forEach((cat) =>
          cat.classList.toggle("active", cat.getAttribute("data-menu-category") === target)
        );
      });
    });
  }

  /* ---------------------------------------------------------------------
     Interactive cocktail map (cocktails.html)
  --------------------------------------------------------------------- */
  const cocktailData = {
    "electric-koi": {
      name: "Electric Koi",
      subtitle: "Signature · Citrus & Umami",
      description: "Our house signature: vodka washed with yuzu, a whisper of blue curaçao, and a saline mist that makes the citrus glow.",
      ingredients: ["Yuzu-washed vodka", "Blue curaçao", "Saline mist", "Shiso leaf"],
      price: "$26",
      image: "images/cocktails/electric-koi.jpg",
    },
    "ronins-ember": {
      name: "Ronin's Ember",
      subtitle: "Smoked · Bold",
      description: "Mezcal meets smoked plum and a chili tincture that lingers like the last light over the skyline.",
      ingredients: ["Mezcal", "Smoked plum", "Shiso", "Chili tincture"],
      price: "$24",
      image: "images/cocktails/ronins-ember.jpg",
    },
    "sakura-static": {
      name: "Sakura Static",
      subtitle: "Floral · Sparkling",
      description: "Gin softened with cherry blossom cordial and lychee, finished with a crackle of sparkling sake.",
      ingredients: ["Gin", "Cherry blossom cordial", "Lychee", "Sparkling sake"],
      price: "$25",
      image: "images/cocktails/sakura-static.jpg",
    },
    "wasabi-volt": {
      name: "Wasabi Volt",
      subtitle: "Spiced · Sharp",
      description: "Tequila charged with wasabi honey, lime, and cucumber for a jolt that wakes up the whole table.",
      ingredients: ["Tequila", "Wasabi honey", "Lime", "Cucumber"],
      price: "$23",
      image: "images/cocktails/wasabi-volt.jpg",
    },
    "neon-nashi": {
      name: "Neon Nashi",
      subtitle: "Citrus · Bright",
      description: "Shochu, Asian pear, and ginger lifted with soda — clean, glowing, dangerously easy to drink.",
      ingredients: ["Shochu", "Asian pear", "Ginger", "Soda"],
      price: "$22",
      image: "images/cocktails/neon-nashi.jpg",
    },
    "obsidian-koi": {
      name: "Obsidian Koi",
      subtitle: "Smoked · Dark",
      description: "Japanese whisky, activated charcoal, and black sesame, shadowed with bitters — the color of the rooftop at midnight.",
      ingredients: ["Japanese whisky", "Activated charcoal", "Black sesame", "Bitters"],
      price: "$27",
      image: "images/cocktails/obsidian-koi.jpg",
    },
    glasswing: {
      name: "Glasswing",
      subtitle: "Floral · Color-Shifting",
      description: "Rum, passionfruit, and coconut swirl with butterfly pea, shifting hue as it settles in the glass.",
      ingredients: ["Rum", "Passionfruit", "Coconut", "Butterfly pea"],
      price: "$24",
      image: "images/cocktails/glasswing.jpg",
    },
    "voltage-yuzu": {
      name: "Voltage Yuzu",
      subtitle: "Citrus · Silken",
      description: "Vodka and yuzu kosho whipped with egg white into a silken, citrus-forward finish.",
      ingredients: ["Vodka", "Yuzu kosho", "Egg white", "Citrus oils"],
      price: "$23",
      image: "images/cocktails/voltage-yuzu.jpg",
    },
    "hidden-pour": {
      name: "???",
      subtitle: "Speakeasy Exclusive",
      description: "Some pours never make the public map. Find the hidden room to taste what isn't listed anywhere else.",
      ingredients: ["Classified"],
      price: "Members Only",
      image: "images/cocktails/hidden-pour.jpg",
    },
  };

  function initCocktailMap() {
    const pins = document.querySelectorAll("[data-cocktail]");
    const detail = document.querySelector("[data-cocktail-detail]");
    if (!pins.length || !detail) return;

    function render(id) {
      const item = cocktailData[id];
      if (!item) return;
      detail.innerHTML = `
        <div class="cocktail-detail-body">
          <span class="subtitle">${item.subtitle}</span>
          <h3>${item.name}</h3>
          <p>${item.description}</p>
          <div class="ingredients">${item.ingredients.map((ing) => `<span>${ing}</span>`).join("")}</div>
          <div class="price">${item.price}</div>
        </div>
        <div class="cocktail-detail-media">
          <img src="${item.image}" alt="${item.name}" loading="lazy">
        </div>
      `;
    }

    pins.forEach((pin) => {
      pin.addEventListener("click", () => {
        pins.forEach((p) => p.setAttribute("aria-pressed", "false"));
        pin.setAttribute("aria-pressed", "true");
        render(pin.getAttribute("data-cocktail"));
      });
    });

    // Reveal Neon Nashi by default for a populated first impression.
    const first = document.querySelector('[data-cocktail="neon-nashi"]');
    if (first) {
      first.setAttribute("aria-pressed", "true");
      render(first.getAttribute("data-cocktail"));
    }

    alignMapPaths();
    if (window.ResizeObserver) {
      const map = document.querySelector(".cocktail-map");
      if (map) new ResizeObserver(alignMapPaths).observe(map);
    } else {
      window.addEventListener("resize", alignMapPaths);
    }
  }

  /* The pin icons are a fixed pixel size while the map itself is a fluid
     percentage-based square, so a footpath's endpoints hand-tuned to touch
     an icon's contour at one viewport width drift off it at another. Instead
     of baking per-breakpoint coordinates, each path's `data-from`/`data-to`
     name the two pins it connects, and this recomputes the endpoints from
     the pins' actual rendered contours -- so the dashes reach every icon
     edge-to-edge at any screen size.

     A glass's silhouette isn't a rectangle (stems, garnishes, handles stick
     out unevenly), so aiming a ray from its bounding-box center can exit
     through a corner where there's no artwork at all. Instead this samples
     points along the real outline of both icons and connects the closest
     pair -- guaranteed to land on actual linework on both ends. */
  function iconContourPoints(pinEl) {
    const points = [];
    pinEl.querySelectorAll(".map-pin-icon path").forEach((p) => {
      const ctm = p.getScreenCTM();
      if (!ctm) return;
      const len = p.getTotalLength();
      if (!len) return;
      const samples = Math.max(12, Math.min(80, Math.round(len / 12)));
      for (let i = 0; i <= samples; i++) {
        const pt = p.getPointAtLength((len * i) / samples);
        const screenPt = new DOMPoint(pt.x, pt.y).matrixTransform(ctm);
        points.push({ x: screenPt.x, y: screenPt.y });
      }
    });
    return points;
  }

  function closestPointPair(pointsA, pointsB) {
    let best = null;
    for (const a of pointsA) {
      for (const b of pointsB) {
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (!best || d < best.d) best = { a, b, d };
      }
    }
    return best;
  }

  function alignMapPaths() {
    const svg = document.querySelector(".map-paths");
    if (!svg) return;
    const svgRect = svg.getBoundingClientRect();
    if (!svgRect.width || !svgRect.height) return;
    const scale = svgRect.width / 100; // viewBox is 0 0 100 100 on a square map
    const TOUCH_MARGIN = 1.2; // px left between the dash tip and the contour

    const contourCache = new Map();
    const contourFor = (id, el) => {
      if (!contourCache.has(id)) contourCache.set(id, iconContourPoints(el));
      return contourCache.get(id);
    };

    svg.querySelectorAll(".map-path[data-from][data-to]").forEach((path) => {
      const fromPin = document.querySelector(`[data-cocktail="${path.dataset.from}"]`);
      const toPin = document.querySelector(`[data-cocktail="${path.dataset.to}"]`);
      if (!fromPin || !toPin) return;

      const fromPoints = contourFor(path.dataset.from, fromPin);
      const toPoints = contourFor(path.dataset.to, toPin);
      const closest = closestPointPair(fromPoints, toPoints);
      if (!closest || !closest.d) return;

      const ux = (closest.a.x - closest.b.x) / closest.d;
      const uy = (closest.a.y - closest.b.y) / closest.d;
      const start = { x: closest.a.x + ux * TOUCH_MARGIN, y: closest.a.y + uy * TOUCH_MARGIN };
      const end = { x: closest.b.x - ux * TOUCH_MARGIN, y: closest.b.y - uy * TOUCH_MARGIN };

      const x1 = (start.x - svgRect.left) / scale;
      const y1 = (start.y - svgRect.top) / scale;
      const x2 = (end.x - svgRect.left) / scale;
      const y2 = (end.y - svgRect.top) / scale;

      const length = Math.hypot(x2 - x1, y2 - y1);
      if (length < 1) return; // icons overlapping at this size -- leave the last-known path alone

      // Solve the dash pattern so a full dash always lands exactly on both
      // endpoints (matching the original hand-tuned paths' look), instead
      // of letting the dash rhythm cut off mid-dash at an arbitrary length.
      const dash = 0.6;
      const targetPeriod = 2.8;
      let n = Math.max(1, Math.round((length - dash) / targetPeriod));
      let period = (length - dash) / n;
      if (period - dash < 0.3 && n > 1) {
        n -= 1;
        period = (length - dash) / n;
      }
      const gap = Math.max(0.3, period - dash);
      period = dash + gap;
      const cycleN = Math.max(1, Math.round(28 / period));
      const dashCycle = -Math.round(cycleN * period * 100) / 100;

      path.setAttribute("d", `M${x1.toFixed(2)} ${y1.toFixed(2)} L${x2.toFixed(2)} ${y2.toFixed(2)}`);
      path.style.strokeDasharray = `${dash} ${gap.toFixed(3)}`;
      path.style.setProperty("--dash-cycle", dashCycle.toFixed(2));
    });
  }

  /* ---------------------------------------------------------------------
     Forms (reservations.html, speakeasy.html, contact.html)
  --------------------------------------------------------------------- */
  function initForm(formSelector, confirmationSelector, codePrefix) {
    const form = document.querySelector(formSelector);
    const confirmation = document.querySelector(confirmationSelector);
    if (!form) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      const code = `${codePrefix}-${Math.floor(1000 + Math.random() * 9000)}`;
      if (confirmation) {
        const codeEl = confirmation.querySelector("[data-code]");
        if (codeEl) codeEl.textContent = code;
        form.style.display = "none";
        confirmation.classList.add("show");
      }
      AudioEngine.playConfirm();
    });
  }

  /* ---------------------------------------------------------------------
     Init
  --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    initAudioUI();
    initNavToggle();
    initScrollReveal();
    initCursorGlow();
    initMenuTabs();
    initCocktailMap();
    initForm("[data-reservation-form]", "[data-reservation-confirmation]", "NK-RES");
    initForm("[data-speakeasy-form]", "[data-speakeasy-confirmation]", "NK-VIP");
    initForm("[data-contact-form]", "[data-contact-confirmation]", "NK-MSG");

    // Footer year
    document.querySelectorAll("[data-year]").forEach((el) => {
      el.textContent = new Date().getFullYear();
    });
  });
})();
