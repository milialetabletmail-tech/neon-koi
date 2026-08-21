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

  // Same product but a different size is a different line — someone
  // buying a 44 and a 48 of the same print has two distinct pieces
  // coming, not "one item, qty 2". size is null (not just absent) for
  // items added without a size (the catalog grid's quick add has no
  // size picker at all), so two unsized adds of the same id still
  // correctly bump one shared line's qty.
  function sameLine(item, id, size) {
    return item.id === id && (item.size || null) === (size || null);
  }

  // Adds one unit of `product` ({id, name, price, image, size?}) —
  // bumps qty if this exact id+size line is already in the cart
  // rather than adding a duplicate.
  function addToCart(product) {
    const items = readCart();
    const size = product.size || null;
    const existing = items.find((item) => sameLine(item, product.id, size));
    if (existing) {
      existing.qty = (Number(existing.qty) || 0) + 1;
    } else {
      items.push({
        id: product.id,
        name: product.name,
        price: Number(product.price) || 0,
        image: product.image,
        size: size,
        qty: 1,
      });
    }
    writeCart(items);
    return items;
  }

  // qty <= 0 removes the line entirely rather than leaving a 0-qty row.
  function setCartQty(id, size, qty) {
    let items = readCart();
    if (qty <= 0) {
      items = items.filter((item) => !sameLine(item, id, size));
    } else {
      const existing = items.find((item) => sameLine(item, id, size));
      if (existing) existing.qty = qty;
    }
    writeCart(items);
    return items;
  }

  function removeFromCart(id, size) {
    const items = readCart().filter((item) => !sameLine(item, id, size));
    writeCart(items);
    return items;
  }

  function clearCart() {
    writeCart([]);
  }

  // ------------------------------------------------------------
  // ORDER TRACKING — a separate localStorage record from the cart,
  // created once (cart.html's submit button) and then read/cleared by
  // order.html. Just {items, submittedAt}: order-page.js derives the
  // current stage from how much time has passed since submittedAt
  // rather than storing a stage index, so the tracker keeps advancing
  // correctly across reloads/tab closes without its own timer state
  // to get out of sync.
  // ------------------------------------------------------------
  const ORDER_KEY = 'ln-team-order';

  function readOrder() {
    try {
      const raw = JSON.parse(localStorage.getItem(ORDER_KEY));
      return raw && Array.isArray(raw.items) && raw.items.length ? raw : null;
    } catch (err) {
      return null;
    }
  }

  function createOrder(items) {
    const order = { items: items, submittedAt: Date.now() };
    localStorage.setItem(ORDER_KEY, JSON.stringify(order));
    return order;
  }

  // "Отменить заказ" — the brand has no real fulfillment backend yet
  // to actually cancel anything against, so for now this just wipes
  // the local order record entirely: order.html goes back to its
  // empty state, as if nothing had been submitted.
  function clearOrder() {
    localStorage.removeItem(ORDER_KEY);
  }

  // ------------------------------------------------------------
  // ACCOUNT — same "no real backend" localStorage mock as the cart
  // and order tracker above: one record holding an email/password
  // pair (set at registration) plus a loggedIn flag, so logging out
  // and back in doesn't lose the "registered" state. The password is
  // stored in plain text — fine for a visual mock with no server
  // behind it, but this is not how real auth would ever be built.
  // ------------------------------------------------------------
  const ACCOUNT_KEY = 'ln-team-account';

  function readAccount() {
    try {
      const raw = JSON.parse(localStorage.getItem(ACCOUNT_KEY));
      return raw && raw.email ? raw : null;
    } catch (err) {
      return null;
    }
  }

  function writeAccount(account) {
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
    renderAccountDropdown();
  }

  function registerAccount(email, password) {
    const account = { email: email, password: password, registeredAt: Date.now(), loggedIn: true };
    writeAccount(account);
    return account;
  }

  // Mock login: the only account that can exist locally is whichever
  // one was last registered on this browser, so "wrong credentials"
  // just means the entered email/password don't match that record.
  function loginAccount(email, password) {
    const account = readAccount();
    if (!account || account.email !== email || account.password !== password) return null;
    account.loggedIn = true;
    writeAccount(account);
    return account;
  }

  function logoutAccount() {
    const account = readAccount();
    if (!account) return;
    account.loggedIn = false;
    writeAccount(account);
  }

  function isLoggedIn() {
    const account = readAccount();
    return Boolean(account && account.loggedIn);
  }

  // Swaps the header's account dropdown between the guest links
  // (Войти/Регистрация) and the logged-in ones (Личный кабинет/
  // Выйти) — runs on every page via nav.js, so the header reflects
  // login state everywhere without each page's own markup needing to
  // know about it.
  function renderAccountDropdown() {
    const dropdown = document.getElementById('account-dropdown');
    if (!dropdown) return;

    if (isLoggedIn()) {
      dropdown.innerHTML =
        '<a href="account.html" data-accent="teal">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/><circle cx="12" cy="7" r="3.5"/></svg>' +
          '<span>Личный кабинет</span>' +
        '</a>' +
        '<button type="button" class="account-dropdown-logout" data-accent="sage">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 7 15 12 10 17"/><line x1="15" y1="12" x2="3" y2="12"/></svg>' +
          '<span>Выйти</span>' +
        '</button>';

      const logoutBtn = dropdown.querySelector('.account-dropdown-logout');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
          logoutAccount();
          if (document.body.dataset.page === 'account') {
            window.location.reload();
          }
        });
      }
    } else {
      dropdown.innerHTML =
        '<a href="account.html" data-accent="teal">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>' +
          '<span>Войти</span>' +
        '</a>' +
        '<a href="account.html" data-accent="sage">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>' +
          '<span>Регистрация</span>' +
        '</a>';
    }
  }

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Clones `sourceImg`, then animates the clone shrinking/rotating
  // into `cartEl` (the header cart icon) before removing it and
  // pulsing `cartEl` — the "fly to cart" payoff on add-to-cart, shared
  // by js/catalog.js and js/product-page.js. No-op under
  // prefers-reduced-motion, same as every other motion effect on the
  // site (see main.js) — callers should skip calling this at all in
  // that case rather than rely on it silently doing nothing.
  function flyToCart(sourceImg, cartEl) {
    if (prefersReducedMotion || !sourceImg || !cartEl) return;

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

    // opacity is the longer of the two transitions (it starts after a
    // delay — see .cart-fly-clone) so it's the one that actually ends
    // last; filtering on it avoids removing the clone the instant the
    // shorter transform transition finishes, mid-fade.
    clone.addEventListener('transitionend', (evt) => {
      // Only one of the two transitions actually removes anything —
      // without this guard the listener (not `once`, since it has to
      // survive the earlier transform transitionend) would run this
      // block twice.
      if (evt.propertyName !== 'opacity') return;
      clone.remove();
      cartEl.classList.remove('cart-bump');
      // Reflow so the class can be re-added immediately by a second
      // fast add-to-cart click and still restart the animation.
      void cartEl.offsetWidth;
      cartEl.classList.add('cart-bump');
    });
  }

  // Shared cart API for page-specific scripts (js/catalog.js,
  // js/cart-page.js, js/product-page.js) — every page loads nav.js
  // already for the header/burger wiring, so the cart data layer
  // lives here instead of a separate script tag every page would
  // otherwise need.
  window.LNCart = {
    KEY: CART_KEY,
    getItems: readCart,
    addItem: addToCart,
    setQty: setCartQty,
    removeItem: removeFromCart,
    clear: clearCart,
    flyToCart: flyToCart,
  };

  window.LNOrder = {
    KEY: ORDER_KEY,
    get: readOrder,
    create: createOrder,
    clear: clearOrder,
  };

  window.LNAccount = {
    KEY: ACCOUNT_KEY,
    get: readAccount,
    register: registerAccount,
    login: loginAccount,
    logout: logoutAccount,
    isLoggedIn: isLoggedIn,
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
    renderAccountDropdown();
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

  // Keeps this tab's header in sync if the account changes in
  // another tab (mirrors the cart's own storage listener elsewhere).
  window.addEventListener('storage', (evt) => {
    if (evt.key === ACCOUNT_KEY) renderAccountDropdown();
  });
})();
