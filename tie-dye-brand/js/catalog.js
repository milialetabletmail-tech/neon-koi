/* ============================================================
   CATALOG PAGE — wires up the "В корзину" buttons on the two cards
   that have real product data (data-add-to-cart, see catalog.html).
   Every other card's CTA stays `disabled` — nothing to add yet.
   ============================================================ */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    const buttons = document.querySelectorAll('[data-add-to-cart]');

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
