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

    return { firstInteraction, playClick, playConfirm, toggleMute, isMuted, justStarted };
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

    // Click SFX on every link/button, except the mute control itself.
    document.addEventListener("click", (e) => {
      const target = e.target.closest("a, button");
      if (!target || target.hasAttribute("data-sound-toggle")) return;
      AudioEngine.playClick();
    });
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

    // Reveal the first cocktail by default for a populated first impression.
    const first = pins[0];
    if (first) {
      first.setAttribute("aria-pressed", "true");
      render(first.getAttribute("data-cocktail"));
    }
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
