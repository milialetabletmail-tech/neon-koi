/* ============================================================
   PRODUCT PAGE (product.html) — reads ?id= from the URL, looks the
   product up in window.LNProducts (js/products.js), and renders it.
   Unknown/missing id shows the not-found state instead.
   ============================================================ */

(function () {
  'use strict';

  function formatPrice(amount) {
    return amount.toLocaleString('ru-RU') + ' ₽';
  }

  function renderColors(product) {
    const list = document.getElementById('product-colors');
    list.textContent = '';
    product.colors.forEach((color) => {
      const li = document.createElement('li');
      li.className = 'product-color';
      const swatch = document.createElement('span');
      swatch.className = 'product-color-swatch';
      swatch.style.backgroundColor = color.hex;
      const label = document.createElement('span');
      label.className = 'product-color-label';
      label.textContent = color.label;
      li.append(swatch, label);
      list.appendChild(li);
    });
  }

  function render(product) {
    document.title = product.name + ' — LN-Team';

    const img = document.getElementById('product-image');
    img.src = product.image;
    img.alt = product.alt || product.name;

    document.getElementById('product-name').textContent = product.name;
    document.getElementById('product-price').textContent = formatPrice(product.price);
    document.getElementById('product-description').textContent = product.description;
    renderColors(product);

    document.getElementById('product-layout').hidden = false;

    const addBtn = document.getElementById('product-add-to-cart');
    const label = addBtn.textContent;
    let resetTimer = null;
    const cartLink = document.getElementById('cart-link');

    addBtn.addEventListener('click', () => {
      window.LNCart.addItem({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
      });

      window.LNCart.flyToCart(img, cartLink);

      window.clearTimeout(resetTimer);
      addBtn.classList.add('is-added');
      addBtn.textContent = 'Добавлено';
      resetTimer = window.setTimeout(() => {
        addBtn.classList.remove('is-added');
        addBtn.textContent = label;
      }, 1400);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const id = new URLSearchParams(window.location.search).get('id');
    const product = (window.LNProducts || []).find((item) => item.id === id);

    if (!product) {
      document.getElementById('product-not-found').hidden = false;
      return;
    }

    render(product);
  });
})();
