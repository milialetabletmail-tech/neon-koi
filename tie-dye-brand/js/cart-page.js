/* ============================================================
   CART PAGE — renders js/nav.js's localStorage cart (window.LNCart)
   as an editable list: qty +/-, remove, running total, and a submit
   button that clears the cart and swaps in a confirmation panel.
   Still no real backend — "Отправить заказ в лабораторию" doesn't
   reach a server yet, it just closes out the local order the same
   way a real submit would from the shopper's point of view.
   ============================================================ */

(function () {
  'use strict';

  // Fixed nationwide delivery fee (see offer.html §5.2) — added on top
  // of the items' total, not per item.
  const DELIVERY_FEE = 500;

  function formatPrice(amount) {
    return amount.toLocaleString('ru-RU') + ' ₽';
  }

  function itemMarkup(item) {
    const li = document.createElement('li');
    li.className = 'cart-item';
    li.dataset.id = item.id;
    li.dataset.size = item.size || '';
    li.innerHTML =
      '<div class="cart-item-media"><img src="' + item.image + '" alt="" loading="lazy"></div>' +
      '<div class="cart-item-info">' +
        '<p class="cart-item-name">' + item.name + '</p>' +
        (item.size ? '<p class="cart-item-size">Размер: ' + item.size + '</p>' : '') +
        '<p class="cart-item-price">' + formatPrice(item.price) + '</p>' +
      '</div>' +
      '<div class="cart-item-qty">' +
        '<button type="button" class="cart-qty-btn" data-action="decrease" aria-label="Уменьшить количество">–</button>' +
        '<span class="cart-item-qty-value">' + item.qty + '</span>' +
        '<button type="button" class="cart-qty-btn" data-action="increase" aria-label="Увеличить количество">+</button>' +
      '</div>' +
      '<button type="button" class="cart-item-remove" aria-label="Убрать «' + item.name + '» из корзины">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
      '</button>';
    return li;
  }

  function render() {
    const emptyEl = document.getElementById('cart-empty');
    const listEl = document.getElementById('cart-list');
    const summaryEl = document.getElementById('cart-summary');
    const successEl = document.getElementById('cart-success');
    if (!emptyEl || !listEl || !summaryEl) return;

    successEl.hidden = true;

    const items = window.LNCart.getItems();

    if (!items.length) {
      emptyEl.hidden = false;
      listEl.hidden = true;
      summaryEl.hidden = true;
      listEl.textContent = '';
      return;
    }

    emptyEl.hidden = true;
    listEl.hidden = false;
    summaryEl.hidden = false;

    listEl.textContent = '';
    let total = 0;
    let count = 0;
    items.forEach((item) => {
      total += item.price * item.qty;
      count += item.qty;
      listEl.appendChild(itemMarkup(item));
    });

    document.getElementById('cart-summary-count').textContent = String(count);
    document.getElementById('cart-summary-delivery').textContent = formatPrice(DELIVERY_FEE);
    document.getElementById('cart-summary-total').textContent = formatPrice(total + DELIVERY_FEE);
  }

  document.addEventListener('DOMContentLoaded', () => {
    render();

    const listEl = document.getElementById('cart-list');
    listEl.addEventListener('click', (evt) => {
      const row = evt.target.closest('.cart-item');
      if (!row) return;
      const id = row.dataset.id;
      const size = row.dataset.size || null;
      const item = window.LNCart.getItems().find((entry) => entry.id === id && (entry.size || null) === size);
      if (!item) return;

      if (evt.target.closest('[data-action="increase"]')) {
        window.LNCart.setQty(id, size, item.qty + 1);
        render();
      } else if (evt.target.closest('[data-action="decrease"]')) {
        window.LNCart.setQty(id, size, item.qty - 1);
        render();
      } else if (evt.target.closest('.cart-item-remove')) {
        window.LNCart.removeItem(id, size);
        render();
      }
    });

    // Keeps this tab's view in sync if the cart changes in another
    // tab (or via the header badge logic elsewhere on this same page).
    window.addEventListener('storage', (evt) => {
      if (evt.key === window.LNCart.KEY) render();
    });

    // A <form> (rather than a bare button) so the browser's own HTML5
    // validation enforces the required contact/delivery fields and
    // consent checkboxes before the order goes through.
    const checkoutForm = document.getElementById('cart-checkout-form');
    if (checkoutForm) {
      checkoutForm.addEventListener('submit', (evt) => {
        evt.preventDefault();
        const items = window.LNCart.getItems();
        if (!items.length) return;
        window.LNOrder.create(items);
        window.LNCart.clear();
        checkoutForm.reset();

        document.getElementById('cart-empty').hidden = true;
        document.getElementById('cart-list').hidden = true;
        document.getElementById('cart-summary').hidden = true;
        document.getElementById('cart-success').hidden = false;
      });
    }
  });
})();
