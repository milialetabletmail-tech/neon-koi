/* ============================================================
   ORDER TRACKING PAGE — reads window.LNOrder (js/nav.js) and renders
   its 12-stage progress as a vertical dotted track with the actual
   ordered shirt's photo sliding from dot to dot. The current stage is
   derived from elapsed time since the order's submittedAt rather than
   stored separately, so a reload mid-wait still lands on the right
   step; a 1s ticker just re-derives and re-renders as time passes.
   "Отменить заказ" (see js/nav.js's LNOrder.reset) restarts
   submittedAt at now — there's no real fulfillment backend yet to
   cancel against, so for now it's a way to replay the sequence
   without waiting out the real 20s-per-stage delay.
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

  function getStageIndex(order) {
    const elapsed = Date.now() - order.submittedAt;
    const index = Math.floor(elapsed / STAGE_MS);
    return Math.max(0, Math.min(STAGES.length - 1, index));
  }

  // Looks up the tracked item's colors from window.LNProducts (the
  // cart only stores id/name/price/image/size/qty, not colors) so the
  // final "готов к получению" stage can pulse the shirt in its own
  // print's palette instead of one fixed brand color.
  function getItemColors(item) {
    const product = (window.LNProducts || []).find((p) => p.id === item.id);
    return product && product.colors && product.colors.length ? product.colors : null;
  }

  function renderSteps(stepsEl) {
    stepsEl.innerHTML = STAGES.map((label) =>
      '<li class="order-step">' +
        '<span class="order-step-rail"><span class="order-step-dot"></span></span>' +
        '<span class="order-step-label">' + label + '</span>' +
      '</li>'
    ).join('');
  }

  function measure(trackEl) {
    const trackRect = trackEl.getBoundingClientRect();
    const dots = Array.from(trackEl.querySelectorAll('.order-step-dot'));
    return dots.map((dot) => {
      const r = dot.getBoundingClientRect();
      return { x: r.left - trackRect.left + r.width / 2, y: r.top - trackRect.top + r.height / 2 };
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const emptyEl = document.getElementById('order-empty');
    const contentEl = document.getElementById('order-content');
    if (!emptyEl || !contentEl) return;

    const order = window.LNOrder.get();
    if (!order) {
      emptyEl.hidden = false;
      contentEl.hidden = true;
      return;
    }

    emptyEl.hidden = true;
    contentEl.hidden = false;

    const item = order.items[0];
    const otherCount = order.items.length - 1;

    document.getElementById('order-item-image').src = item.image;
    document.getElementById('order-item-image').alt = item.name;
    document.getElementById('order-item-name').textContent = item.name;
    document.getElementById('order-item-meta').textContent =
      (item.size ? 'Размер ' + item.size + ' · ' : '') +
      formatPrice(item.price) +
      (otherCount > 0 ? ' · ещё ' + otherCount + ' в заказе' : '');

    const trackEl = document.getElementById('order-track');
    const stepsEl = document.getElementById('order-steps');
    const lineFillEl = document.getElementById('order-track-fill');
    const shirtEl = document.getElementById('order-track-shirt');
    const shirtImgEl = document.getElementById('order-track-shirt-img');
    const currentLabelEl = document.getElementById('order-stage-current');

    shirtImgEl.src = item.image;
    shirtImgEl.alt = item.name;

    const colors = getItemColors(item);
    if (colors) {
      shirtEl.style.setProperty('--order-glow-a', colors[0].hex);
      shirtEl.style.setProperty('--order-glow-b', (colors[1] || colors[0]).hex);
    }

    renderSteps(stepsEl);
    let dotCenters = measure(trackEl);

    let lastIndex = -1;

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
      lineFillEl.style.height = Math.max(0, center.y - dotCenters[0].y) + 'px';

      shirtEl.classList.toggle('is-ready', index === STAGES.length - 1);
      currentLabelEl.textContent = 'Сейчас: ' + STAGES[index];

      lastIndex = index;
    }

    function tick() {
      const index = getStageIndex(window.LNOrder.get() || order);
      if (index !== lastIndex) applyStage(index);
    }

    // Full-height rail line only needs the first/last dot positions —
    // set once, it doesn't move as the stage advances (only the fill
    // and the shirt do).
    const lineEl = document.getElementById('order-track') && trackEl.querySelector('.order-track-line');
    if (lineEl) {
      lineEl.style.left = dotCenters[0].x + 'px';
      lineEl.style.top = dotCenters[0].y + 'px';
      lineEl.style.height = (dotCenters[dotCenters.length - 1].y - dotCenters[0].y) + 'px';
    }

    applyStage(getStageIndex(order));
    const ticker = window.setInterval(tick, 1000);

    window.addEventListener('resize', () => {
      dotCenters = measure(trackEl);
      if (lineEl) {
        lineEl.style.left = dotCenters[0].x + 'px';
        lineEl.style.top = dotCenters[0].y + 'px';
        lineEl.style.height = (dotCenters[dotCenters.length - 1].y - dotCenters[0].y) + 'px';
      }
      applyStage(lastIndex === -1 ? getStageIndex(order) : lastIndex);
    });

    const cancelBtn = document.getElementById('order-cancel');
    cancelBtn.addEventListener('click', () => {
      window.LNOrder.reset();
      lastIndex = -1;
      applyStage(0);
    });

    window.addEventListener('beforeunload', () => window.clearInterval(ticker));
  });
})();
