/* ============================================================
   CATALOG PAGE — wires up the "В корзину" buttons on the two cards
   that have real product data (data-add-to-cart, see catalog.html).
   Every other card's CTA stays `disabled` — nothing to add yet.

   Clicking one also flies a clone of the product photo from the card
   to the header cart icon (see .cart-fly-clone / .cart-bump in
   style.css) — skipped under prefers-reduced-motion, same as every
   other motion effect on the site (see main.js).
   ============================================================ */

(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function flyToCart(sourceImg, cartEl) {
    const cartIcon = cartEl.querySelector('svg') || cartEl;
    const startRect = sourceImg.getBoundingClientRect();
    const endRect = cartIcon.getBoundingClientRect();

    const clone = sourceImg.cloneNode(true);
    clone.className = 'cart-fly-clone';
    clone.style.left = startRect.left + 'px';
    clone.style.top = startRect.top + 'px';
    clone.style.width = startRect.width + 'px';
    clone.style.height = startRect.height + 'px';
    document.body.appendChild(clone);

    const dx = (endRect.left + endRect.width / 2) - (startRect.left + startRect.width / 2);
    const dy = (endRect.top + endRect.height / 2) - (startRect.top + startRect.height / 2);
    const scale = Math.max(endRect.width / startRect.width, 0.09);

    // Two rAFs, not one — the clone needs one full frame painted at
    // its start position first, or the browser can coalesce that
    // with the transform change below and it never visibly "starts"
    // from the card at all, just pops in already mid-flight.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        clone.style.transform = 'translate(' + dx + 'px, ' + dy + 'px) scale(' + scale + ') rotate(14deg)';
        clone.style.opacity = '0.2';
      });
    });

    clone.addEventListener('transitionend', () => {
      clone.remove();
      cartEl.classList.remove('cart-bump');
      // Reflow so the class can be re-added immediately by a second
      // fast add-to-cart click and still restart the animation.
      void cartEl.offsetWidth;
      cartEl.classList.add('cart-bump');
    }, { once: true });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const buttons = document.querySelectorAll('[data-add-to-cart]');
    const cartLink = document.getElementById('cart-link');

    buttons.forEach((btn) => {
      const label = btn.textContent;
      let resetTimer = null;

      btn.addEventListener('click', () => {
        window.LNCart.addItem({
          id: btn.dataset.id,
          name: btn.dataset.name,
          price: btn.dataset.price,
          image: btn.dataset.image,
        });

        if (!prefersReducedMotion && cartLink) {
          const sourceImg = btn.closest('.catalog-card').querySelector('.catalog-card-media img');
          if (sourceImg) flyToCart(sourceImg, cartLink);
        }

        window.clearTimeout(resetTimer);
        btn.classList.add('is-added');
        btn.textContent = 'Добавлено';
        resetTimer = window.setTimeout(() => {
          btn.classList.remove('is-added');
          btn.textContent = label;
        }, 1400);
      });
    });
  });
})();
