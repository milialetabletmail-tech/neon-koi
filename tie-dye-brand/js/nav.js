/* ============================================================
   TIE-DYE BRAND — shared site header / navigation
   Loaded on every page. Handles the burger overlay, the account
   dropdown, and the cart count badge. The hero-only scroll-driven
   `.nav-solid` toggle lives in main.js (index.html only, since it
   needs the Color Burst hero's own scroll wiring) — everywhere else
   `.nav-solid` just ships in the HTML from first paint.
   ============================================================ */

(function () {
  'use strict';

  const CART_KEY = 'ln-team-cart';

  function readCart() {
    try {
      const raw = JSON.parse(localStorage.getItem(CART_KEY));
      return Array.isArray(raw) ? raw : [];
    } catch (err) {
      return [];
    }
  }

  function writeCart(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    renderCartCount();
  }

  function getCartCount() {
    return readCart().reduce((sum, item) => sum + (Number(item && item.qty) || 0), 0);
  }

  function renderCartCount() {
    const badge = document.getElementById('cart-count');
    if (!badge) return;
    const count = getCartCount();
    badge.textContent = String(count);
    badge.hidden = count === 0;
  }

  // Adds one unit of `product` ({id, name, price, image}) — bumps qty
  // if it's already in the cart rather than adding a duplicate line.
  function addToCart(product) {
    const items = readCart();
    const existing = items.find((item) => item.id === product.id);
    if (existing) {
      existing.qty = (Number(existing.qty) || 0) + 1;
    } else {
      items.push({
        id: product.id,
        name: product.name,
        price: Number(product.price) || 0,
        image: product.image,
        qty: 1,
      });
    }
    writeCart(items);
    return items;
  }

  // qty <= 0 removes the line entirely rather than leaving a 0-qty row.
  function setCartQty(id, qty) {
    let items = readCart();
    if (qty <= 0) {
      items = items.filter((item) => item.id !== id);
    } else {
      const existing = items.find((item) => item.id === id);
      if (existing) existing.qty = qty;
    }
    writeCart(items);
    return items;
  }

  function removeFromCart(id) {
    const items = readCart().filter((item) => item.id !== id);
    writeCart(items);
    return items;
  }

  // Shared cart API for page-specific scripts (js/catalog.js,
  // js/cart-page.js) — every page loads nav.js already for the header/
  // burger wiring, so the cart data layer lives here instead of a
  // separate script tag every page would otherwise need.
  window.LNCart = {
    KEY: CART_KEY,
    getItems: readCart,
    addItem: addToCart,
    setQty: setCartQty,
    removeItem: removeFromCart,
  };

  function wireDropdown(toggleId, panelId) {
    const toggle = document.getElementById(toggleId);
    const panel = document.getElementById(panelId);
    if (!toggle || !panel) return;

    function close() {
      panel.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
    }
    function open() {
      panel.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
    }

    toggle.addEventListener('click', (evt) => {
      evt.stopPropagation();
      if (panel.hidden) open(); else close();
    });
    document.addEventListener('click', (evt) => {
      if (!panel.hidden && !panel.contains(evt.target) && evt.target !== toggle) close();
    });
    document.addEventListener('keydown', (evt) => {
      if (evt.key === 'Escape' && !panel.hidden) close();
    });
  }

  function wireOverlayMenu() {
    const toggle = document.getElementById('burger-toggle');
    const overlay = document.getElementById('nav-overlay');
    const closeBtn = document.getElementById('nav-overlay-close');
    if (!toggle || !overlay) return;

    function close() {
      overlay.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('nav-open');
    }
    function open() {
      overlay.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
      document.body.classList.add('nav-open');
    }

    toggle.addEventListener('click', () => {
      if (overlay.hidden) open(); else close();
    });
    if (closeBtn) closeBtn.addEventListener('click', close);
    overlay.querySelectorAll('a').forEach((link) => link.addEventListener('click', close));
    document.addEventListener('keydown', (evt) => {
      if (evt.key === 'Escape' && !overlay.hidden) close();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderCartCount();
    wireDropdown('account-toggle', 'account-dropdown');
    wireOverlayMenu();

    // Pages with no Color Burst hero have nothing to protect a
    // transparent bar from — go straight to the solid state. index.html
    // has `.hero-end-sentinel` and handles this itself in main.js.
    const header = document.getElementById('site-header');
    if (header && !document.querySelector('.colorburst')) {
      header.classList.add('nav-solid');
    }
  });
})();
