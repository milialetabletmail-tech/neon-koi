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

    function ensureContext() {
      if (ctx) return;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      ctx = new Ctx();

      masterGain = ctx.createGain();
      masterGain.gain.value = muted ? 0 : VOLUME;
      masterGain.connect(ctx.destination);

      ambientGain = ctx.createGain();
      ambientGain.gain.value = 0.16;
      ambientGain.connect(masterGain);

      sfxGain = ctx.createGain();
      sfxGain.gain.value = 0.5;
      sfxGain.connect(masterGain);
    }

    function startAmbient() {
      if (ambientStarted) return;
      ensureContext();
      ambientStarted = true;
      ambientStartedAt = Date.now();

      // Warm, clean sub-bass pad — sine waves only (no sawtooth grit,
      // no close detuning) so the low end stays smooth instead of buzzing.
      const baseFreqs = [55, 82.4]; // A1 root, E2 fifth
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 320;
      filter.Q.value = 0.4;
      filter.connect(ambientGain);

      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.05;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 100;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();

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
      const filterLfo = ctx.createOscillator();
      filterLfo.frequency.value = 0.035;
      const filterLfoGain = ctx.createGain();
      filterLfoGain.gain.value = 480;
      filterLfo.connect(filterLfoGain);
      filterLfoGain.connect(filter.frequency);
      filterLfo.start();

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

      function playNote(freq, time) {
        const osc = ctx.createOscillator();
        osc.type = "triangle";
        osc.frequency.value = freq;
        const noteGain = ctx.createGain();
        noteGain.gain.setValueAtTime(0, time);
        noteGain.gain.linearRampToValueAtTime(0.5, time + 0.16);
        noteGain.gain.exponentialRampToValueAtTime(0.001, time + noteLength);
        osc.connect(noteGain);
        noteGain.connect(filter);
        osc.start(time);
        osc.stop(time + noteLength + 0.05);
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

    // A soft two-note "snap" for picking a chip/pill (party size, time,
    // occasion) — pitches up rather than the click tick's flat blip, so
    // choosing a value reads as a small decision landing, not a generic
    // link tap. Deliberately shorter and quieter than playConfirm so it
    // never competes with the reservation-complete chord.
    function playSelect() {
      ensureContext();
      if (ctx.state === "suspended") ctx.resume();
      const now = ctx.currentTime;
      [980, 1470].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        const start = now + i * 0.045;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(i === 0 ? 0.05 : 0.075, start + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.09);
        osc.connect(gain);
        gain.connect(sfxGain);
        osc.start(start);
        osc.stop(start + 0.1);
      });
    }

    // A heavier "latch" sound for the Speakeasy wizard's step advance —
    // a low thud under a short tick, like a mechanism releasing, used
    // instead of the sitewide click tick. Reinforces "a private door,
    // not a web form" on every step forward through the request.
    function playStep() {
      ensureContext();
      if (ctx.state === "suspended") ctx.resume();
      const now = ctx.currentTime;

      const thud = ctx.createOscillator();
      thud.type = "sine";
      thud.frequency.setValueAtTime(160, now);
      thud.frequency.exponentialRampToValueAtTime(90, now + 0.12);
      const thudGain = ctx.createGain();
      thudGain.gain.setValueAtTime(0.0001, now);
      thudGain.gain.linearRampToValueAtTime(0.16, now + 0.008);
      thudGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
      thud.connect(thudGain);
      thudGain.connect(sfxGain);
      thud.start(now);
      thud.stop(now + 0.18);

      const tick = ctx.createOscillator();
      tick.type = "triangle";
      tick.frequency.value = 640;
      const tickGain = ctx.createGain();
      tickGain.gain.setValueAtTime(0.0001, now);
      tickGain.gain.linearRampToValueAtTime(0.06, now + 0.004);
      tickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
      tick.connect(tickGain);
      tickGain.connect(sfxGain);
      tick.start(now);
      tick.stop(now + 0.06);
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
      const target = muted ? 0 : VOLUME;
      masterGain.gain.cancelScheduledValues(ctx.currentTime);
      masterGain.gain.linearRampToValueAtTime(target, ctx.currentTime + 0.4);
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

    return { firstInteraction, playClick, playSelect, playStep, playConfirm, toggleMute, isMuted, justStarted };
  })();

  /* ---------------------------------------------------------------------
     Boot: wire up ambient start on first gesture, mute button, and
     click SFX delegation across all interactive elements.
  --------------------------------------------------------------------- */
  function initAudioUI() {
    const soundToggle = document.querySelector("[data-sound-toggle]");
    const startOnce = () => {
      AudioEngine.firstInteraction();
      window.removeEventListener("pointerdown", startOnce);
      window.removeEventListener("keydown", startOnce);
    };
    window.addEventListener("pointerdown", startOnce, { once: true });
    window.addEventListener("keydown", startOnce, { once: true });

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

    // Click SFX on every link/button, except the mute control (has its
    // own toggle sound via toggleMute) and the Speakeasy wizard's Next
    // button (gets a heavier "latch" sound instead — see playStep()).
    document.addEventListener("click", (e) => {
      const target = e.target.closest("a, button");
      if (!target || target.hasAttribute("data-sound-toggle") || target.hasAttribute("data-wizard-next")) return;
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

    // Coalesce to at most one alignment pass per animation frame -- a live
    // window resize drag (or tablet rotation/split-view) can fire the
    // observer many times in quick succession, and running the full
    // realignment on every single one of those stacks up main-thread work
    // and makes the page feel like it's hung.
    let alignQueued = false;
    function scheduleAlignMapPaths() {
      if (alignQueued) return;
      alignQueued = true;
      requestAnimationFrame(() => {
        alignQueued = false;
        alignMapPaths();
      });
    }

    // Align paths first, while every pin (including Neon Nashi) is still at
    // its default, unpressed size. Marking Neon Nashi pressed beforehand
    // would align its paths to the 1.4x-scaled icon, so the moment a visitor
    // picks a different pin and it shrinks back down, the paths would stay
    // reaching for where the enlarged icon used to be.
    alignMapPaths();

    // Reveal Neon Nashi by default for a populated first impression.
    const first = document.querySelector('[data-cocktail="neon-nashi"]');
    if (first) {
      first.setAttribute("aria-pressed", "true");
      render(first.getAttribute("data-cocktail"));
    }

    if (window.ResizeObserver) {
      const map = document.querySelector(".cocktail-map");
      if (map) new ResizeObserver(scheduleAlignMapPaths).observe(map);
    } else {
      window.addEventListener("resize", scheduleAlignMapPaths);
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
     pair -- guaranteed to land on actual linework on both ends.

     The icons are traced neon-sign contours with very dense path data, so
     getTotalLength()/getPointAtLength() are expensive per path. The sampled
     points are in the path's own local coordinate space and never change
     (the artwork is static), so they're computed once per path and cached
     on the element -- alignMapPaths() then only has to redo the cheap part
     (re-reading each path's current on-screen matrix) on every resize,
     instead of re-walking the whole contour every time. */
  function localPathPoints(p) {
    if (p._localContourPoints) return p._localContourPoints;
    const len = p.getTotalLength();
    const points = [];
    if (len) {
      const samples = Math.max(12, Math.min(80, Math.round(len / 12)));
      for (let i = 0; i <= samples; i++) {
        points.push(p.getPointAtLength((len * i) / samples));
      }
    }
    p._localContourPoints = points;
    return points;
  }

  function iconContourPoints(pinEl) {
    const points = [];
    pinEl.querySelectorAll(".map-pin-icon path").forEach((p) => {
      const ctm = p.getScreenCTM();
      if (!ctm) return;
      localPathPoints(p).forEach((pt) => {
        const screenPt = new DOMPoint(pt.x, pt.y).matrixTransform(ctm);
        points.push({ x: screenPt.x, y: screenPt.y });
      });
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
     Forms (reservations.html, contact.html)
  --------------------------------------------------------------------- */
  // Marks invalid fields inline (a warm border, a short message reusing
  // the browser's own validationMessage text, and a small shake) instead
  // of calling the browser's native reportValidity(), which pops stock
  // OS-chrome tooltips over an otherwise fully-themed form — the one
  // moment the illusion used to break for anyone who missed a field.
  function ensureFieldError(field, message) {
    let el = field.querySelector(".field-error");
    if (!el) {
      el = document.createElement("p");
      el.className = "field-error";
      field.appendChild(el);
    }
    el.textContent = message;
  }

  function clearFieldError(field) {
    const el = field.querySelector(".field-error");
    if (el) el.remove();
  }

  function refreshValidationState(form) {
    let firstInvalid = null;
    form.querySelectorAll(".field").forEach((field) => {
      const invalidControl = field.querySelector(":invalid");
      field.classList.toggle("field-invalid", !!invalidControl);
      if (invalidControl) {
        ensureFieldError(field, invalidControl.validationMessage || "Please complete this field.");
        if (!firstInvalid) firstInvalid = field;
      } else {
        clearFieldError(field);
      }
    });
    return firstInvalid;
  }

  function clearFieldIfValid(control) {
    const field = control.closest(".field");
    if (!field || !field.classList.contains("field-invalid")) return;
    if (!field.querySelector(":invalid")) {
      field.classList.remove("field-invalid");
      clearFieldError(field);
    }
  }

  function initForm(formSelector, confirmationSelector, codePrefix, scramble = false, customValidation = false) {
    const form = document.querySelector(formSelector);
    const confirmation = document.querySelector(confirmationSelector);
    if (!form) return;

    if (customValidation) {
      form.setAttribute("novalidate", "");
      form.addEventListener("input", (e) => clearFieldIfValid(e.target));
      form.addEventListener("change", (e) => clearFieldIfValid(e.target));
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!form.checkValidity()) {
        if (customValidation) {
          const firstInvalid = refreshValidationState(form);
          // Scroll to the field and stop there — no .focus(). Focusing an
          // input pops the on-screen keyboard on touch devices, and on a
          // real phone that produces its own flaky-looking symptom: the
          // keyboard covers/repositions the very field we just
          // highlighted, so the next tap near "Confirm Reservation" lands
          // on the keyboard instead and just dismisses it rather than
          // resubmitting — making the red highlight appear to work only
          // "every other" attempt. The scroll + warm border + message
          // below are enough of a cue on their own; the user can tap the
          // field themselves when they're ready to fix it.
          if (firstInvalid) {
            firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        } else {
          form.reportValidity();
        }
        return;
      }
      if (customValidation) refreshValidationState(form);
      const digits = String(Math.floor(1000 + Math.random() * 9000));
      if (confirmation) {
        const codeEl = confirmation.querySelector("[data-code]");
        form.style.display = "none";
        confirmation.classList.add("show");
        if (codeEl) {
          if (scramble) scrambleCode(codeEl, `${codePrefix}-`, digits);
          else codeEl.textContent = `${codePrefix}-${digits}`;
        }
      }
      AudioEngine.playConfirm();
    });
  }

  /* ---------------------------------------------------------------------
     Reservations — live table preview
     Mirrors the party-size/time pills and the date field into a single
     line in the intro column as they're answered, so the page feels
     like it's listening instead of just waiting for a submit. No-ops
     everywhere but reservations.html.
  --------------------------------------------------------------------- */
  function initReservationPreview() {
    const root = document.querySelector("[data-reservation-preview]");
    if (!root) return;
    const guestsOut = root.querySelector("[data-preview-guests]");
    const dateOut = root.querySelector("[data-preview-date]");
    const timeOut = root.querySelector("[data-preview-time]");

    function labelFor(input) {
      if (!input) return null;
      return document.querySelector(`label[for="${input.id}"]`);
    }

    function setPart(el, text, filled) {
      if (!el) return;
      el.textContent = text;
      el.classList.toggle("is-filled", filled);
    }

    function updateGuests() {
      const label = labelFor(document.querySelector('input[name="guests"]:checked'));
      setPart(guestsOut, label ? `${label.textContent} guests` : "party size", !!label);
    }

    function updateTime() {
      const label = labelFor(document.querySelector('input[name="time"]:checked'));
      setPart(timeOut, label ? label.textContent : "time", !!label);
    }

    function updateDate() {
      const dateInput = document.getElementById("r-date");
      if (dateInput && dateInput.value) {
        const parsed = new Date(`${dateInput.value}T00:00:00`);
        const formatted = parsed.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
        setPart(dateOut, formatted, true);
      } else {
        setPart(dateOut, "date", false);
      }
    }

    document.querySelectorAll('input[name="guests"]').forEach((el) => el.addEventListener("change", updateGuests));
    document.querySelectorAll('input[name="time"]').forEach((el) => el.addEventListener("change", updateTime));
    const dateInput = document.getElementById("r-date");
    if (dateInput) dateInput.addEventListener("input", updateDate);
  }

  /* ---------------------------------------------------------------------
     Reservations — koi silhouette parallax
     A few px of cursor-follow drift on the oversized background koi,
     so the "atmospheric silhouette" reads as alive rather than a
     static watermark. Skipped for touch input and reduced-motion.
  --------------------------------------------------------------------- */
  function initReservationsParallax() {
    const intro = document.querySelector(".reservations-intro");
    const koi = document.querySelector(".reservations-koi");
    if (!intro || !koi) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(hover: none)").matches) return;

    intro.addEventListener("pointermove", (e) => {
      const rect = intro.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      koi.style.transform = `translate(calc(-50% + ${(x * 16).toFixed(1)}px), calc(-50% + ${(y * 16).toFixed(1)}px))`;
    });
    intro.addEventListener("pointerleave", () => {
      koi.style.transform = "translate(-50%, -50%)";
    });
  }

  /* ---------------------------------------------------------------------
     Reservations — pill selection sound
     Chip labels aren't <a>/<button>, so they never reached the generic
     click-tick delegate below — picking a party size or time slot was
     silent. Give it its own small "snap" instead of just wiring it into
     the generic tick, so choosing a value feels like its own moment.
  --------------------------------------------------------------------- */
  function initPillSound() {
    document.querySelectorAll(".pill-group input[type=\"radio\"]").forEach((el) => {
      el.addEventListener("change", () => AudioEngine.playSelect());
    });
  }

  // Minimal roman numeral converter — plenty for a handful of form steps.
  const ROMAN_NUMERALS = [
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  function toRoman(num) {
    let result = "";
    let n = num;
    ROMAN_NUMERALS.forEach(([value, symbol]) => {
      while (n >= value) {
        result += symbol;
        n -= value;
      }
    });
    return result;
  }

  /* ---------------------------------------------------------------------
     The Gold Room — speakeasy.html's step-by-step VIP request form.
     One field on stage at a time: "Next" (or Enter) softly dissolves the
     current field away and lets the next one settle into focus. Same
     native browser validation and success chord as the other forms,
     gated per step instead of all at once.
  --------------------------------------------------------------------- */
  function initSpeakeasyForm() {
    const form = document.querySelector("[data-speakeasy-form]");
    const confirmation = document.querySelector("[data-speakeasy-confirmation]");
    if (!form) return;

    form.setAttribute("novalidate", "");
    form.addEventListener("input", (e) => clearFieldIfValid(e.target));
    form.addEventListener("change", (e) => clearFieldIfValid(e.target));

    // Same inline treatment as Reservations instead of reportValidity()'s
    // native OS bubble — remove-then-reflow-then-add so the shake replays
    // on a second failed attempt, not just the first.
    function markFieldInvalid(wrapper, message) {
      wrapper.classList.remove("field-invalid");
      void wrapper.offsetWidth;
      wrapper.classList.add("field-invalid");
      ensureFieldError(wrapper, message);
    }

    const steps = Array.from(form.querySelectorAll(".wizard-step"));
    const nextBtn = form.querySelector("[data-wizard-next]");
    const countEl = form.querySelector("[data-wizard-count]");
    const fillEl = form.querySelector("[data-wizard-progress-fill]");
    const total = steps.length;
    const STEP_MS = 500;
    let current = 0;

    function fieldOf(step) {
      return step.querySelector("input, textarea");
    }

    function updateMeta() {
      const isLast = current === total - 1;
      if (countEl) {
        countEl.textContent = `${toRoman(current + 1)} — ${toRoman(total)}`;
      }
      if (fillEl) fillEl.style.width = `${((current + 1) / total) * 100}%`;
      if (nextBtn) {
        nextBtn.textContent = isLast ? "Request Access" : "Next →";
        nextBtn.type = isLast ? "submit" : "button";
      }
    }

    function goToStep(index) {
      AudioEngine.playStep();
      const leaving = steps[current];
      leaving.classList.remove("is-active");
      leaving.classList.add("is-leaving");

      window.setTimeout(() => {
        leaving.classList.remove("is-leaving");
        leaving.hidden = true;

        current = index;
        const entering = steps[current];
        entering.hidden = false;
        entering.classList.add("is-entering");
        void entering.offsetWidth; // force reflow so the enter transition actually plays
        entering.classList.remove("is-entering");
        entering.classList.add("is-active");

        updateMeta();
        const field = fieldOf(entering);
        if (field) field.focus({ preventScroll: true });
      }, STEP_MS);
    }

    function tryAdvance() {
      const field = fieldOf(steps[current]);
      if (field && !field.checkValidity()) {
        markFieldInvalid(steps[current], field.validationMessage || "Please complete this field.");
        return;
      }
      if (current < total - 1) goToStep(current + 1);
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", (e) => {
        if (nextBtn.type === "button") {
          e.preventDefault();
          tryAdvance();
        }
      });
    }

    steps.forEach((step, i) => {
      const input = step.querySelector("input");
      if (!input) return;
      input.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        if (i === total - 1) {
          if (form.requestSubmit) form.requestSubmit();
          else form.dispatchEvent(new Event("submit", { cancelable: true }));
        } else {
          tryAdvance();
        }
      });
    });

    updateMeta();

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!form.checkValidity()) {
        // Every prior step already passed its own check in tryAdvance(),
        // so the only field that can still be invalid here is the one
        // currently on stage.
        const field = fieldOf(steps[current]);
        if (field && !field.checkValidity()) {
          markFieldInvalid(steps[current], field.validationMessage || "Please complete this field.");
        }
        return;
      }
      const digits = String(Math.floor(1000 + Math.random() * 9000));
      if (confirmation) {
        const codeEl = confirmation.querySelector("[data-code]");
        form.style.display = "none";
        confirmation.classList.add("show");
        if (codeEl) scrambleCode(codeEl, "NK-VIP-", digits);
      }
      AudioEngine.playConfirm();
    });
  }

  // "Password-crack" reveal: rapidly cycles random 4-digit endings for
  // ~0.5s before locking in the real code, like a terminal brute-forcing
  // the last digits of an access key.
  function scrambleCode(el, prefix, finalDigits) {
    const duration = 500;
    const tickMs = 45;
    const startedAt = Date.now();

    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      if (elapsed >= duration) {
        window.clearInterval(timer);
        el.textContent = `${prefix}${finalDigits}`;
        return;
      }
      const randomDigits = String(Math.floor(1000 + Math.random() * 9000));
      el.textContent = `${prefix}${randomDigits}`;
    }, tickMs);
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
    initForm("[data-reservation-form]", "[data-reservation-confirmation]", "NK-RES", true, true);
    initReservationPreview();
    initReservationsParallax();
    initPillSound();
    initSpeakeasyForm();
    initForm("[data-contact-form]", "[data-contact-confirmation]", "NK-MSG");

    // Footer year
    document.querySelectorAll("[data-year]").forEach((el) => {
      el.textContent = new Date().getFullYear();
    });
  });
})();
