/* ============================================================
   ACCOUNT PAGE — login/register tabs for guests, a small dashboard
   (email + current order, if any) once window.LNAccount (js/nav.js)
   reports someone logged in. Same "no real backend" localStorage
   mock as the cart/order tracker: registering just writes an
   email/password record locally, login checks against it. Validation
   is hand-rolled (novalidate on both forms) so error copy stays in
   Russian and matches the site's look, same reasoning as
   js/cart-page.js's checkout form.
   ============================================================ */

(function () {
  'use strict';

  function formatPrice(amount) {
    return amount.toLocaleString('ru-RU') + ' ₽';
  }

  document.addEventListener('DOMContentLoaded', () => {
    const guestEl = document.getElementById('account-guest');
    const dashboardEl = document.getElementById('account-dashboard');
    if (!guestEl || !dashboardEl || !window.LNAccount) return;

    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    function showTab(which) {
      const isLogin = which === 'login';
      tabLogin.classList.toggle('is-active', isLogin);
      tabLogin.setAttribute('aria-selected', String(isLogin));
      tabRegister.classList.toggle('is-active', !isLogin);
      tabRegister.setAttribute('aria-selected', String(!isLogin));
      loginForm.hidden = !isLogin;
      registerForm.hidden = isLogin;
    }

    tabLogin.addEventListener('click', () => showTab('login'));
    tabRegister.addEventListener('click', () => showTab('register'));

    function setFieldError(input, errorId, message) {
      const errorEl = document.getElementById(errorId);
      const wrapper = input.closest('.account-field') || input.closest('.account-consent');
      if (errorEl) errorEl.textContent = message;
      if (wrapper) wrapper.classList.toggle('has-error', Boolean(message));
    }

    function setFormError(errorId, message) {
      const el = document.getElementById(errorId);
      if (el) el.textContent = message;
    }

    function renderDashboard() {
      const account = window.LNAccount.get();
      document.getElementById('dashboard-email').textContent = account ? account.email : '';

      const ordersEl = document.getElementById('account-orders');
      const order = window.LNOrder.get();

      if (!order) {
        ordersEl.innerHTML = '<p class="account-orders-empty">У вас пока нет заказов — загляните в <a href="catalog.html" class="account-order-link">каталог</a>, чтобы выбрать первую вещь.</p>';
        return;
      }

      const item = order.items[0];
      const otherCount = order.items.length - 1;
      ordersEl.innerHTML =
        '<div class="account-order-card">' +
          '<img class="account-order-image" src="' + item.image + '" alt="' + item.name + '">' +
          '<div>' +
            '<p class="account-order-name">' + item.name + '</p>' +
            '<p class="account-order-meta">' +
              (item.size ? 'Размер ' + item.size + ' · ' : '') +
              formatPrice(item.price) +
              (otherCount > 0 ? ' · ещё ' + otherCount + ' в заказе' : '') +
            '</p>' +
            '<a href="order.html" class="account-order-link">Отследить заказ →</a>' +
          '</div>' +
        '</div>';
    }

    function renderState() {
      const loggedIn = window.LNAccount.isLoggedIn();
      guestEl.hidden = loggedIn;
      dashboardEl.hidden = !loggedIn;
      if (loggedIn) renderDashboard();
    }

    loginForm.addEventListener('submit', (evt) => {
      evt.preventDefault();
      setFormError('login-error-general', '');

      const email = loginForm.elements.email;
      const password = loginForm.elements.password;
      let firstInvalid = null;

      const emailMsg = email.value.trim() ? '' : 'Пожалуйста, укажите почту';
      setFieldError(email, 'login-error-email', emailMsg);
      if (emailMsg) firstInvalid = email;

      const passwordMsg = password.value ? '' : 'Пожалуйста, укажите пароль';
      setFieldError(password, 'login-error-password', passwordMsg);
      if (passwordMsg && !firstInvalid) firstInvalid = password;

      if (firstInvalid) {
        firstInvalid.focus();
        return;
      }

      const account = window.LNAccount.login(email.value.trim(), password.value);
      if (!account) {
        setFormError('login-error-general', 'Неверная почта или пароль. Ещё не регистрировались — откройте вкладку «Регистрация».');
        return;
      }

      loginForm.reset();
      renderState();
    });

    registerForm.addEventListener('submit', (evt) => {
      evt.preventDefault();

      const email = registerForm.elements.email;
      const password = registerForm.elements.password;
      const consent = registerForm.elements.consent;
      let firstInvalid = null;

      let emailMsg = '';
      if (!email.value.trim()) emailMsg = 'Пожалуйста, укажите почту';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) emailMsg = 'Проверьте адрес почты — он выглядит некорректно';
      setFieldError(email, 'register-error-email', emailMsg);
      if (emailMsg) firstInvalid = email;

      let passwordMsg = '';
      if (!password.value) passwordMsg = 'Пожалуйста, придумайте пароль';
      else if (password.value.length < 6) passwordMsg = 'Пароль должен быть не короче 6 символов';
      setFieldError(password, 'register-error-password', passwordMsg);
      if (passwordMsg && !firstInvalid) firstInvalid = password;

      const consentMsg = consent.checked ? '' : 'Нужно подтвердить согласие на обработку данных';
      setFieldError(consent, 'register-error-consent', consentMsg);
      if (consentMsg && !firstInvalid) firstInvalid = consent;

      if (firstInvalid) {
        firstInvalid.focus();
        return;
      }

      window.LNAccount.register(email.value.trim(), password.value);
      registerForm.reset();
      renderState();
    });

    // Clears a field's error as soon as it's edited, same UX as the
    // checkout form — no need to resubmit just to see it clear.
    [loginForm, registerForm].forEach((form) => {
      form.addEventListener('input', (evt) => {
        const wrapper = evt.target.closest('.account-field');
        if (!wrapper) return;
        wrapper.classList.remove('has-error');
        const errorEl = wrapper.querySelector('.account-field-error');
        if (errorEl) errorEl.textContent = '';
      });
      form.addEventListener('change', (evt) => {
        if (evt.target.type !== 'checkbox' || !evt.target.checked) return;
        const wrapper = evt.target.closest('.account-consent');
        if (!wrapper) return;
        wrapper.classList.remove('has-error');
        const errorEl = document.getElementById('register-error-consent');
        if (errorEl) errorEl.textContent = '';
      });
    });

    document.getElementById('dashboard-logout').addEventListener('click', () => {
      window.LNAccount.logout();
      showTab('login');
      renderState();
    });

    renderState();
  });
})();
