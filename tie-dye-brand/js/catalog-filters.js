/* ============================================================
   CATALOG FILTERS — colors, technique, size, price. All read off
   window.LNProducts (js/products.js) at runtime rather than being
   duplicated as separate data-* attributes on each card: a card's
   product is looked up via the id already on its "В корзину" button
   (data-add-to-cart, see catalog.html), so this stays in sync with
   the same data the product page and cart use.

   Filters combine as AND across groups (color AND technique AND
   size AND price) and OR within a group (any selected color
   matches) — the usual marketplace convention. Cards with no
   matching product (the still-photoless "Фото скоро" placeholders)
   hide whenever any filter is active, same as an out-of-stock item.
   ============================================================ */

(function () {
  'use strict';

  const ALL_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

  document.addEventListener('DOMContentLoaded', () => {
    const products = window.LNProducts || [];
    const cards = Array.from(document.querySelectorAll('.catalog-card'));
    const colorsEl = document.getElementById('filter-colors');
    const techniqueEl = document.getElementById('filter-technique');
    const sizesEl = document.getElementById('filter-sizes');
    const priceMinEl = document.getElementById('filter-price-min');
    const priceMaxEl = document.getElementById('filter-price-max');
    const resetBtn = document.getElementById('filter-reset');
    const emptyEl = document.getElementById('catalog-empty');

    if (!colorsEl || !products.length) return;

    const selectedColors = new Set();
    const selectedTechniques = new Set();
    const selectedSizes = new Set();

    function toggleButton(btn, set, value) {
      btn.classList.toggle('is-active');
      if (set.has(value)) set.delete(value); else set.add(value);
      applyFilters();
    }

    // Swatches come from the union of every product's own colors (in
    // first-seen order), not a fixed list — new products just widen
    // this automatically instead of needing the filter UI hand-kept
    // in sync with products.js.
    const colorMap = new Map();
    products.forEach((product) => {
      (product.colors || []).forEach((color) => {
        if (!colorMap.has(color.label)) colorMap.set(color.label, color.hex);
      });
    });
    colorMap.forEach((hex, label) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'catalog-filter-swatch';
      btn.style.background = hex;
      btn.setAttribute('aria-label', label);
      btn.title = label;
      btn.addEventListener('click', () => toggleButton(btn, selectedColors, label));
      colorsEl.appendChild(btn);
    });

    techniqueEl.querySelectorAll('[data-technique]').forEach((btn) => {
      btn.addEventListener('click', () => toggleButton(btn, selectedTechniques, btn.dataset.technique));
    });

    ALL_SIZES.forEach((size) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'catalog-filter-pill catalog-filter-pill--size';
      btn.textContent = size;
      btn.addEventListener('click', () => toggleButton(btn, selectedSizes, size));
      sizesEl.appendChild(btn);
    });

    function getProduct(card) {
      const btn = card.querySelector('[data-add-to-cart]');
      return btn ? products.find((product) => product.id === btn.dataset.id) : null;
    }

    function hasActiveFilters() {
      return Boolean(
        selectedColors.size || selectedTechniques.size || selectedSizes.size ||
        priceMinEl.value !== '' || priceMaxEl.value !== ''
      );
    }

    function applyFilters() {
      const active = hasActiveFilters();
      resetBtn.hidden = !active;

      const min = priceMinEl.value === '' ? null : Number(priceMinEl.value);
      const max = priceMaxEl.value === '' ? null : Number(priceMaxEl.value);

      let visibleCount = 0;
      cards.forEach((card) => {
        if (!active) {
          card.hidden = false;
          visibleCount += 1;
          return;
        }

        const product = getProduct(card);
        if (!product) {
          card.hidden = true;
          return;
        }

        const colorOk = !selectedColors.size || product.colors.some((color) => selectedColors.has(color.label));
        const techniqueOk = !selectedTechniques.size || selectedTechniques.has(product.technique);
        const productSizes = product.sizes || ALL_SIZES;
        const sizeOk = !selectedSizes.size || productSizes.some((size) => selectedSizes.has(size));
        const priceOk = (min === null || product.price >= min) && (max === null || product.price <= max);

        const visible = colorOk && techniqueOk && sizeOk && priceOk;
        card.hidden = !visible;
        if (visible) visibleCount += 1;
      });

      emptyEl.hidden = visibleCount > 0;
    }

    priceMinEl.addEventListener('input', applyFilters);
    priceMaxEl.addEventListener('input', applyFilters);

    resetBtn.addEventListener('click', () => {
      selectedColors.clear();
      selectedTechniques.clear();
      selectedSizes.clear();
      priceMinEl.value = '';
      priceMaxEl.value = '';
      [colorsEl, techniqueEl, sizesEl].forEach((group) => {
        group.querySelectorAll('.is-active').forEach((el) => el.classList.remove('is-active'));
      });
      applyFilters();
    });

    applyFilters();
  });
})();
