/* ============================================================
   CATALOG PAGE — wires up the "В корзину" buttons on the cards that
   have real product data (data-add-to-cart, see catalog.html). Every
   still-photoless card's CTA stays `disabled` — nothing to add yet.

   Clicking one also flies the product photo to the header cart icon
   (window.LNCart.flyToCart, defined in nav.js and shared with
   js/product-page.js).
   ============================================================ */

(function () {
  'use strict';

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

        const sourceImg = btn.closest('.catalog-card').querySelector('.catalog-card-media img');
        window.LNCart.flyToCart(sourceImg, cartLink);

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
