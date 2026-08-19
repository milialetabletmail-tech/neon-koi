/* ============================================================
   CATALOG PAGE — a "В корзину" click on any card with real product
   data (data-add-to-cart, see catalog.html) opens the shared size
   modal instead of adding straight away; every still-photoless
   card's CTA stays `disabled`. Confirming a size in the modal is what
   actually calls window.LNCart.addItem and flies the photo to the
   header cart icon (window.LNCart.flyToCart, defined in nav.js and
   shared with js/product-page.js).
   ============================================================ */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    const cartLink = document.getElementById('cart-link');

    const modal = document.getElementById('size-modal');
    const backdrop = document.getElementById('size-modal-backdrop');
    const closeBtn = document.getElementById('size-modal-close');
    const confirmBtn = document.getElementById('size-modal-confirm');
    const optionsEl = document.getElementById('size-modal-options');
    const hintEl = document.getElementById('size-modal-hint');
    const imageEl = document.getElementById('size-modal-image');
    const nameEl = document.getElementById('size-modal-name');
    const priceEl = document.getElementById('size-modal-price');

    if (!modal) return;

    // The button + its card's <img> the modal is currently open for —
    // set on open, read back on confirm so the fly-to-cart animation
    // still starts from the actual card photo, not the modal (which
    // is already closed and gone by the time it plays).
    let activeBtn = null;
    let activeImg = null;

    function resetSizeSelection() {
      optionsEl.querySelectorAll('input[name="modal-size"]').forEach((input) => {
        input.checked = false;
      });
      hintEl.hidden = true;
      optionsEl.classList.remove('is-shaking');
    }

    function openModal(btn) {
      activeBtn = btn;
      activeImg = btn.closest('.catalog-card').querySelector('.catalog-card-media img');

      imageEl.src = btn.dataset.image;
      imageEl.alt = '';
      nameEl.textContent = btn.dataset.name;
      priceEl.textContent = Number(btn.dataset.price).toLocaleString('ru-RU') + ' ₽';

      resetSizeSelection();

      modal.hidden = false;
      document.body.classList.add('size-modal-open');
    }

    function closeModal() {
      modal.hidden = true;
      document.body.classList.remove('size-modal-open');
      activeBtn = null;
      activeImg = null;
    }

    document.querySelectorAll('[data-add-to-cart]').forEach((btn) => {
      btn.addEventListener('click', () => openModal(btn));
    });

    backdrop.addEventListener('click', closeModal);
    closeBtn.addEventListener('click', closeModal);
    document.addEventListener('keydown', (evt) => {
      if (evt.key === 'Escape' && !modal.hidden) closeModal();
    });

    confirmBtn.addEventListener('click', () => {
      const sizeInput = optionsEl.querySelector('input[name="modal-size"]:checked');

      if (!sizeInput) {
        hintEl.hidden = false;
        optionsEl.classList.remove('is-shaking');
        void optionsEl.offsetWidth;
        optionsEl.classList.add('is-shaking');
        return;
      }

      const btn = activeBtn;
      const img = activeImg;

      window.LNCart.addItem({
        id: btn.dataset.id,
        name: btn.dataset.name,
        price: btn.dataset.price,
        image: btn.dataset.image,
        size: sizeInput.value,
      });

      closeModal();
      window.LNCart.flyToCart(img, cartLink);

      const label = btn.dataset.label || btn.textContent;
      btn.dataset.label = label;
      btn.classList.add('is-added');
      btn.textContent = 'Добавлено';
      window.clearTimeout(btn._resetTimer);
      btn._resetTimer = window.setTimeout(() => {
        btn.classList.remove('is-added');
        btn.textContent = label;
      }, 1400);
    });
  });
})();
