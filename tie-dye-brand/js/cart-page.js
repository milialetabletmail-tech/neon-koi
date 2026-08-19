/* ============================================================
   CART PAGE — renders js/nav.js's localStorage cart (window.LNCart)
   as an editable list: qty +/-, remove, running total. No checkout
   yet — there's nowhere for an order to go until that exists.
   ============================================================ */

(function () {
  'use strict';

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
    if (!emptyEl || !listEl || !summaryEl) return;

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
    document.getElementById('cart-summary-total').textContent = formatPrice(total);
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
  });
})();
