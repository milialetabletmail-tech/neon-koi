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

      // Slow-moving detuned pad, filtered for a warm rooftop-lounge drone.
      const baseFreqs = [55, 55.6, 82.4]; // A1, slightly detuned A1, E2
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 420;
      filter.Q.value = 0.7;
      filter.connect(ambientGain);

      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.05;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 180;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();

      baseFreqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = i === 2 ? "sine" : "sawtooth";
        osc.frequency.value = freq;
        const oscGain = ctx.createGain();
        oscGain.gain.value = i === 2 ? 0.5 : 0.18;
        osc.connect(oscGain);
        oscGain.connect(filter);
        osc.start();
      });

      // Occasional shimmering high tone, like distant neon hum.
      const shimmer = ctx.createOscillator();
      shimmer.type = "sine";
      shimmer.frequency.value = 1760;
      const shimmerGain = ctx.createGain();
      shimmerGain.gain.value = 0;
      shimmer.connect(shimmerGain);
      shimmerGain.connect(ambientGain);
      shimmer.start();

      function pulseShimmer() {
        const now = ctx.currentTime;
        shimmerGain.gain.cancelScheduledValues(now);
        shimmerGain.gain.setValueAtTime(0, now);
        shimmerGain.gain.linearRampToValueAtTime(0.035, now + 2);
        shimmerGain.gain.linearRampToValueAtTime(0, now + 5);
        setTimeout(pulseShimmer, 7000 + Math.random() * 6000);
      }
      pulseShimmer();
    }

    function playClick() {
      ensureContext();
      if (ctx.state === "suspended") ctx.resume();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(920, now);
      osc.frequency.exponentialRampToValueAtTime(240, now + 0.16);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(gain);
      gain.connect(sfxGain);
      osc.start(now);
      osc.stop(now + 0.2);
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

    function firstInteraction() {
      ensureContext();
      if (ctx.state === "suspended") ctx.resume();
      startAmbient();
    }

    return { firstInteraction, playClick, playConfirm, toggleMute, isMuted };
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
    },
    "ronins-ember": {
      name: "Ronin's Ember",
      subtitle: "Smoked · Bold",
      description: "Mezcal meets smoked plum and a chili tincture that lingers like the last light over the skyline.",
      ingredients: ["Mezcal", "Smoked plum", "Shiso", "Chili tincture"],
      price: "$24",
    },
    "sakura-static": {
      name: "Sakura Static",
      subtitle: "Floral · Sparkling",
      description: "Gin softened with cherry blossom cordial and lychee, finished with a crackle of sparkling sake.",
      ingredients: ["Gin", "Cherry blossom cordial", "Lychee", "Sparkling sake"],
      price: "$25",
    },
    "wasabi-volt": {
      name: "Wasabi Volt",
      subtitle: "Spiced · Sharp",
      description: "Tequila charged with wasabi honey, lime, and cucumber for a jolt that wakes up the whole table.",
      ingredients: ["Tequila", "Wasabi honey", "Lime", "Cucumber"],
      price: "$23",
    },
    "neon-nashi": {
      name: "Neon Nashi",
      subtitle: "Citrus · Bright",
      description: "Shochu, Asian pear, and ginger lifted with soda — clean, glowing, dangerously easy to drink.",
      ingredients: ["Shochu", "Asian pear", "Ginger", "Soda"],
      price: "$22",
    },
    "obsidian-koi": {
      name: "Obsidian Koi",
      subtitle: "Smoked · Dark",
      description: "Japanese whisky, activated charcoal, and black sesame, shadowed with bitters — the color of the rooftop at midnight.",
      ingredients: ["Japanese whisky", "Activated charcoal", "Black sesame", "Bitters"],
      price: "$27",
    },
    glasswing: {
      name: "Glasswing",
      subtitle: "Floral · Color-Shifting",
      description: "Rum, passionfruit, and coconut swirl with butterfly pea, shifting hue as it settles in the glass.",
      ingredients: ["Rum", "Passionfruit", "Coconut", "Butterfly pea"],
      price: "$24",
    },
    "voltage-yuzu": {
      name: "Voltage Yuzu",
      subtitle: "Citrus · Silken",
      description: "Vodka and yuzu kosho whipped with egg white into a silken, citrus-forward finish.",
      ingredients: ["Vodka", "Yuzu kosho", "Egg white", "Citrus oils"],
      price: "$23",
    },
    "hidden-pour": {
      name: "???",
      subtitle: "Speakeasy Exclusive",
      description: "Some pours never make the public map. Find the hidden room to taste what isn't listed anywhere else.",
      ingredients: ["Classified"],
      price: "Members Only",
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
        <span class="subtitle">${item.subtitle}</span>
        <h3>${item.name}</h3>
        <p>${item.description}</p>
        <div class="ingredients">${item.ingredients.map((ing) => `<span>${ing}</span>`).join("")}</div>
        <div class="price">${item.price}</div>
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
