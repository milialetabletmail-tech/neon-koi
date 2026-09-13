/* ============================================================
   ORDER TRACKING PAGE — reads window.LNOrder (js/nav.js), which now
   tracks every shirt independently rather than one order at a time.
   With a single tracked shirt, the page goes straight to its status
   track (unchanged from before). With more than one — several shirts
   in one order, or several orders placed back to back — it opens on
   a grid of tiles (photo + current stage) instead, and clicking a
   tile opens that shirt's own dotted track (vertical on mobile,
   horizontal on desktop — see isTrackHorizontal), the same view a
   lone shirt gets. The selected shirt is kept in location.hash
   (#track=<id>) so back/forward and reload land on the right view.

   Each shirt's stage is derived from elapsed time since its own
   submittedAt rather than a stored stage index, so the tracker keeps
   advancing correctly across reloads/tab closes without its own timer
   state to get out of sync. "Отменить заказ" (see js/nav.js's
   LNOrder.cancelItem) drops just that one shirt — there's no real
   fulfillment backend yet to cancel against, so this is just the
   reset button for testing the flow again from scratch.
   ============================================================ */

(function () {
  'use strict';

  const STAGE_MS = 20000;

  const STAGES = [
    'Принято',
    'Подготовка',
    'В работе: скручивание',
    'В работе: окрашивание',
    'Футболка впитывает пигмент',
    'Стираем',
    'Сушим',
    'Брендируем',
    'Упаковываем',
    'Готов к отправке',
    'Отправлен',
    'Готов к получению',
  ];

  function formatPrice(amount) {
    return amount.toLocaleString('ru-RU') + ' ₽';
  }

  function getStageIndex(item) {
    const elapsed = Date.now() - item.submittedAt;
    const index = Math.floor(elapsed / STAGE_MS);
    return Math.max(0, Math.min(STAGES.length - 1, index));
  }

  // Looks up a tracked shirt's colors from window.LNProducts (tracked
  // entries only carry id/name/price/image/size, not colors) so the
  // final "готов к получению" stage can pulse the shirt in its own
  // print's palette instead of one fixed brand color.
  function getItemColors(item) {
    const product = (window.LNProducts || []).find((p) => p.id === item.id);
    return product && product.colors && product.colors.length ? product.colors : null;
  }

  function sortedByNewest(tracked) {
    return tracked.slice().sort((a, b) => b.submittedAt - a.submittedAt);
  }

  function trackIdFromHash() {
    const match = /^#track=(.+)$/.exec(window.location.hash);
    return match ? decodeURIComponent(match[1]) : null;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const emptyEl = document.getElementById('order-empty');
    const gridEl = document.getElementById('order-grid');
    const gridListEl = document.getElementById('order-grid-list');
    const contentEl = document.getElementById('order-content');
    const backLink = document.getElementById('order-back-link');
    if (!emptyEl || !gridEl || !contentEl || !window.LNOrder) return;

    const trackEl = document.getElementById('order-track');
    const stepsEl = document.getElementById('order-steps');
    const lineFillEl = document.getElementById('order-track-fill');
    const lineEl = trackEl.querySelector('.order-track-line');
    const shirtEl = document.getElementById('order-track-shirt');
    const shirtImgEl = document.getElementById('order-track-shirt-img');
    const currentLabelEl = document.getElementById('order-stage-current');
    const cancelBtn = document.getElementById('order-cancel');

    let mode = 'empty'; // 'empty' | 'grid' | 'detail'
    let currentTrackId = null;
    let dotCenters = [];
    let lastIndex = -1;

    function isTrackHorizontal() {
      return window.matchMedia('(min-width: 769px)').matches;
    }

    function measure() {
      const trackRect = trackEl.getBoundingClientRect();
      const dots = Array.from(trackEl.querySelectorAll('.order-step-dot'));
      return dots.map((dot) => {
        const r = dot.getBoundingClientRect();
        return { x: r.left - trackRect.left + r.width / 2, y: r.top - trackRect.top + r.height / 2 };
      });
    }

    // On desktop the track lays out horizontally with labels
    // alternating above/below the line (js just fills whichever of
    // the two label spans applies; CSS grid-places them regardless of
    // DOM order so the dot stays vertically centered no matter which
    // label has text). On mobile both spans sit in a plain flex row
    // and the empty one collapses via :empty, so only the populated
    // label shows.
    function renderSteps() {
      stepsEl.innerHTML = STAGES.map((label, i) => {
        const top = i % 2 === 1 ? label : '';
        const bottom = i % 2 === 1 ? '' : label;
        return '<li class="order-step">' +
          '<span class="order-step-label order-step-label--top">' + top + '</span>' +
          '<span class="order-step-rail"><span class="order-step-dot"></span></span>' +
          '<span class="order-step-label order-step-label--bottom">' + bottom + '</span>' +
        '</li>';
      }).join('');
    }

    function positionLine() {
      if (!lineEl) return;
      lineEl.style.left = dotCenters[0].x + 'px';
      lineEl.style.top = dotCenters[0].y + 'px';
      if (isTrackHorizontal()) {
        lineEl.style.width = (dotCenters[dotCenters.length - 1].x - dotCenters[0].x) + 'px';
        lineEl.style.height = '';
      } else {
        lineEl.style.height = (dotCenters[dotCenters.length - 1].y - dotCenters[0].y) + 'px';
        lineEl.style.width = '';
      }
    }

    function applyStage(index) {
      const steps = Array.from(stepsEl.children);
      steps.forEach((step, i) => {
        step.classList.toggle('is-done', i < index);
        step.classList.toggle('is-active', i === index);
      });

      const center = dotCenters[index];
      shirtEl.style.left = center.x + 'px';
      shirtEl.style.top = center.y + 'px';
      lineFillEl.style.left = dotCenters[0].x + 'px';
      lineFillEl.style.top = dotCenters[0].y + 'px';
      if (isTrackHorizontal()) {
        lineFillEl.style.width = Math.max(0, center.x - dotCenters[0].x) + 'px';
        lineFillEl.style.height = '';
      } else {
        lineFillEl.style.height = Math.max(0, center.y - dotCenters[0].y) + 'px';
        lineFillEl.style.width = '';
      }

      const isReady = index === STAGES.length - 1;
      shirtEl.classList.toggle('is-ready', isReady);
      currentLabelEl.classList.toggle('is-ready', isReady);
      currentLabelEl.textContent = 'Сейчас: ' + STAGES[index];

      lastIndex = index;
    }

    function renderDetail(item) {
      document.getElementById('order-item-image').src = item.image;
      document.getElementById('order-item-image').alt = item.name;
      document.getElementById('order-item-name').textContent = item.name;
      document.getElementById('order-item-meta').textContent =
        (item.size ? 'Размер ' + item.size + ' · ' : '') + formatPrice(item.price);

      shirtImgEl.src = item.image;
      shirtImgEl.alt = item.name;

      shirtEl.style.removeProperty('--order-glow-a');
      shirtEl.style.removeProperty('--order-glow-b');
      const colors = getItemColors(item);
      if (colors) {
        shirtEl.style.setProperty('--order-glow-a', colors[0].hex);
        shirtEl.style.setProperty('--order-glow-b', (colors[1] || colors[0]).hex);
      }

      renderSteps();
      dotCenters = measure();
      lastIndex = -1;
      positionLine();
      applyStage(getStageIndex(item));
    }

    function renderGrid() {
      const tracked = sortedByNewest(window.LNOrder.getAll());
      gridListEl.innerHTML = tracked.map((item) => {
        const index = getStageIndex(item);
        const stageClass = index === STAGES.length - 1 ? ' is-ready' : '';
        return '<li class="order-grid-cell">' +
          '<button type="button" class="order-grid-tile" data-track-id="' + item.trackId + '">' +
            '<img class="order-grid-image" src="' + item.image + '" alt="' + item.name + '">' +
            '<span class="order-grid-name">' + item.name + '</span>' +
            '<span class="order-grid-stage' + stageClass + '">' + STAGES[index] + '</span>' +
          '</button>' +
        '</li>';
      }).join('');
    }

    function showEmpty() {
      mode = 'empty';
      emptyEl.hidden = false;
      gridEl.hidden = true;
      contentEl.hidden = true;
    }

    function showGrid() {
      mode = 'grid';
      currentTrackId = null;
      emptyEl.hidden = true;
      contentEl.hidden = true;
      gridEl.hidden = false;
      renderGrid();
    }

    function showDetail(trackId, tracked) {
      const item = (tracked || window.LNOrder.getAll()).find((entry) => entry.trackId === trackId);
      if (!item) {
        route();
        return;
      }
      mode = 'detail';
      currentTrackId = trackId;
      emptyEl.hidden = true;
      gridEl.hidden = true;
      contentEl.hidden = false;
      backLink.hidden = window.LNOrder.getAll().length <= 1;
      renderDetail(item);
    }

    // Decides which of the three views to show based on how many
    // shirts are tracked and (when there's more than one) whatever
    // trackId is parked in location.hash.
    function route() {
      const tracked = window.LNOrder.getAll();
      if (!tracked.length) {
        showEmpty();
        return;
      }
      if (tracked.length === 1) {
        showDetail(tracked[0].trackId, tracked);
        return;
      }
      const hashId = trackIdFromHash();
      if (hashId && tracked.some((entry) => entry.trackId === hashId)) {
        showDetail(hashId, tracked);
      } else {
        showGrid();
      }
    }

    gridListEl.addEventListener('click', (evt) => {
      const btn = evt.target.closest('.order-grid-tile');
      if (!btn) return;
      window.location.hash = 'track=' + encodeURIComponent(btn.dataset.trackId);
    });

    backLink.addEventListener('click', (evt) => {
      evt.preventDefault();
      window.location.hash = '';
      showGrid();
    });

    window.addEventListener('hashchange', route);

    cancelBtn.addEventListener('click', () => {
      if (!currentTrackId) return;
      window.LNOrder.cancelItem(currentTrackId);
      window.location.hash = '';
      route();
    });

    // Re-derives whichever view is on screen once a second: the grid's
    // stage labels and the detail track's active dot both depend only
    // on elapsed time, not stored state, so a plain re-render keeps
    // them current without any per-shirt timer bookkeeping.
    const ticker = window.setInterval(() => {
      if (mode === 'grid') {
        renderGrid();
      } else if (mode === 'detail' && currentTrackId) {
        const item = window.LNOrder.getById(currentTrackId);
        if (!item) {
          route();
          return;
        }
        const index = getStageIndex(item);
        if (index !== lastIndex) applyStage(index);
      }
    }, 1000);

    window.addEventListener('resize', () => {
      if (mode !== 'detail') return;
      dotCenters = measure();
      positionLine();
      applyStage(lastIndex === -1 ? getStageIndex(window.LNOrder.getById(currentTrackId)) : lastIndex);
    });

    window.addEventListener('beforeunload', () => window.clearInterval(ticker));

    route();
  });
})();
