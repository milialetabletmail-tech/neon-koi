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

  // A real horizontally-swipeable carousel (scroll-snap, drag/swipe
  // native to the browser) rather than a single <img> whose src gets
  // swapped — every slide sits in the same fixed-aspect-ratio frame
  // (see .product-slide in style.css) so all the photos display at
  // one uniform size regardless of their own source dimensions
  // (landscape flat-lays vs. tall mannequin shots). Falls back to the
  // single catalog photo for every product that doesn't have its own
  // `images` list yet (see products.js) — a one-slide gallery just
  // renders no thumbs/dots under it.
  //
  // Returns a getter for "whichever slide's photo is currently in
  // view" so the add-to-cart handler can fly the photo the shopper is
  // actually looking at, not always the first one.
  function renderGallery(product) {
    const track = document.getElementById('product-carousel');
    const thumbsEl = document.getElementById('product-thumbs');
    const prevBtn = document.getElementById('product-carousel-prev');
    const nextBtn = document.getElementById('product-carousel-next');
    const images = product.images && product.images.length ? product.images : [product.image];
    const alt = product.alt || product.name;

    track.textContent = '';
    thumbsEl.textContent = '';
    prevBtn.hidden = true;
    nextBtn.hidden = true;

    const slideImgs = images.map((src) => {
      const slide = document.createElement('div');
      slide.className = 'product-slide';
      const slideImg = document.createElement('img');
      slideImg.src = src;
      slideImg.alt = alt;
      slide.appendChild(slideImg);
      track.appendChild(slide);
      return slideImg;
    });

    let activeIndex = 0;

    if (images.length > 1) {
      const thumbs = images.map((src, index) => {
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
          const slide = track.children[index];
          track.scrollTo({ left: slide.offsetLeft, behavior: 'smooth' });
        });

        thumbsEl.appendChild(thumb);
        return thumb;
      });

      const slides = Array.from(track.children);
      function updateActiveFromScroll() {
        const viewCenter = track.scrollLeft + track.clientWidth / 2;
        let closestIndex = 0;
        let closestDist = Infinity;
        slides.forEach((slide, index) => {
          const dist = Math.abs(slide.offsetLeft + slide.offsetWidth / 2 - viewCenter);
          if (dist < closestDist) {
            closestDist = dist;
            closestIndex = index;
          }
        });
        if (closestIndex === activeIndex) return;
        activeIndex = closestIndex;
        thumbs.forEach((thumb, index) => {
          thumb.classList.toggle('is-active', index === activeIndex);
          thumb.setAttribute('aria-selected', index === activeIndex ? 'true' : 'false');
        });
      }

      track.addEventListener('scroll', updateActiveFromScroll, { passive: true });

      prevBtn.hidden = false;
      nextBtn.hidden = false;

      function goTo(index) {
        const clamped = Math.max(0, Math.min(images.length - 1, index));
        track.scrollTo({ left: slides[clamped].offsetLeft, behavior: 'smooth' });
      }

      prevBtn.addEventListener('click', () => goTo(activeIndex - 1));
      nextBtn.addEventListener('click', () => goTo(activeIndex + 1));
    }

    return { getActiveImg: () => slideImgs[activeIndex] };
  }

  // Warm/cold are the two broad tie-dye approaches the brand works
  // in (see about.html's process recap) — the exact method within
  // either one stays the trade secret it always was, this just says
  // which of the two a given piece used.
  function renderTechniqueBadge(product) {
    if (!product.technique) return;
    const badge = document.createElement('span');
    badge.className = 'product-badge';
    badge.innerHTML = product.technique === 'warm'
      ? '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.5 1.6c.4 2.8-.6 4.6-2 6.2-1.5 1.7-3.3 3.5-3.3 6.6a5.3 5.3 0 0 0 3.9 5.1c-.6-1-.9-2-.7-3.1.2-1.3 1.1-2.2 1.9-3.1.4 1 .9 1.7 1.6 2.3.9.9 1.4 1.7 1.3 2.9a3.9 3.9 0 0 0 3.3-4c0-2.7-1.6-4-2.7-5.6-.4 1-.9 1.7-1.6 2-.5-3.4-.6-6.4-1.7-9.3z"/></svg>Тёплое окрашивание'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v20M4.2 7l15.6 10M4.2 17l15.6-10"/></svg>Холодное окрашивание';
    document.getElementById('product-badges').appendChild(badge);
  }

  function render(product) {
    document.title = product.name + ' — LN-Team';

    const gallery = renderGallery(product);

    document.getElementById('product-name').textContent = product.name;
    document.getElementById('product-price').textContent = formatPrice(product.price);
    document.getElementById('product-description').textContent = product.description;
    renderColors(product);
    renderTechniqueBadge(product);

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

      window.LNCart.flyToCart(gallery.getActiveImg(), cartLink);

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
