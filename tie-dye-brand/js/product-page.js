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

  // Falls back to the single catalog photo for every product that
  // doesn't have its own `images` list yet (see products.js) — a
  // one-thumbnail gallery just doesn't render any thumbs at all.
  function renderGallery(product) {
    const img = document.getElementById('product-image');
    const thumbsEl = document.getElementById('product-thumbs');
    const images = product.images && product.images.length ? product.images : [product.image];

    img.src = images[0];
    img.alt = product.alt || product.name;

    thumbsEl.textContent = '';
    if (images.length < 2) return;

    images.forEach((src, index) => {
      const thumb = document.createElement('button');
      thumb.type = 'button';
      thumb.className = 'product-thumb';
      thumb.setAttribute('role', 'tab');
      thumb.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
      thumb.setAttribute('aria-label', 'Фото ' + (index + 1));
      thumb.classList.toggle('is-active', index === 0);

      const thumbImg = document.createElement('img');
      thumbImg.src = src;
      thumbImg.alt = '';
      thumbImg.loading = 'lazy';
      thumb.appendChild(thumbImg);

      thumb.addEventListener('click', () => {
        img.src = src;
        thumbsEl.querySelectorAll('.product-thumb').forEach((el) => {
          el.classList.remove('is-active');
          el.setAttribute('aria-selected', 'false');
        });
        thumb.classList.add('is-active');
        thumb.setAttribute('aria-selected', 'true');
      });

      thumbsEl.appendChild(thumb);
    });
  }

  function render(product) {
    document.title = product.name + ' — LN-Team';

    const img = document.getElementById('product-image');
    renderGallery(product);

    document.getElementById('product-name').textContent = product.name;
    document.getElementById('product-price').textContent = formatPrice(product.price);
    document.getElementById('product-description').textContent = product.description;
    renderColors(product);

    document.getElementById('product-layout').hidden = false;

    const addBtn = document.getElementById('product-add-to-cart');
    const label = addBtn.textContent;
    let resetTimer = null;
    const cartLink = document.getElementById('cart-link');
    const sizeOptions = document.getElementById('product-size-options');
    const sizeHint = document.getElementById('product-size-hint');

    addBtn.addEventListener('click', () => {
      const sizeInput = document.querySelector('input[name="size"]:checked');

      if (!sizeInput) {
        sizeHint.hidden = false;
        sizeOptions.classList.remove('is-shaking');
        // Reflow so a second click without picking a size still
        // restarts the shake instead of it being a no-op (the class
        // is already there from the first miss).
        void sizeOptions.offsetWidth;
        sizeOptions.classList.add('is-shaking');
        return;
      }

      sizeHint.hidden = true;

      window.LNCart.addItem({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        size: sizeInput.value,
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
