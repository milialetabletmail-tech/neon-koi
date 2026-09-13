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

    const titleEl = document.getElementById('account-guest-title');
    const TAB_TITLES = { login: 'Рады видеть снова', register: 'Создайте аккаунт' };

    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const registerStepEmail = document.getElementById('register-step-email');
    const registerStepPassword = document.getElementById('register-step-password');
    const registerBackBtn = document.getElementById('register-back');

    function showRegisterStep(step) {
      registerStepEmail.hidden = step !== 'email';
      registerStepPassword.hidden = step !== 'password';
      if (step === 'password') {
        const passwordInput = registerForm.elements.password;
        if (passwordInput) passwordInput.focus();
      }
    }

    function showTab(which) {
      const isLogin = which === 'login';
      tabLogin.classList.toggle('is-active', isLogin);
      tabLogin.setAttribute('aria-selected', String(isLogin));
      tabRegister.classList.toggle('is-active', !isLogin);
      tabRegister.setAttribute('aria-selected', String(!isLogin));
      loginForm.hidden = !isLogin;
      registerForm.hidden = isLogin;
      titleEl.textContent = TAB_TITLES[which];
      // Always re-opens on the email step, same as a fresh visit —
      // simpler than trying to preserve half-finished registration
      // progress across a detour to the login tab.
      if (!isLogin) showRegisterStep('email');
    }

    tabLogin.addEventListener('click', () => showTab('login'));
    tabRegister.addEventListener('click', () => showTab('register'));
    registerBackBtn.addEventListener('click', () => showRegisterStep('email'));

    // Password visibility toggles — one per password field, in both
    // steps of registration. Each button finds the input inside its
    // own .account-password-field wrapper rather than a shared id, so
    // the same handler works for both fields.
    document.querySelectorAll('.account-password-toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const input = btn.parentElement.querySelector('input');
        if (!input) return;
        const showing = input.type === 'text';
        input.type = showing ? 'password' : 'text';
        btn.classList.toggle('is-active', !showing);
        btn.setAttribute('aria-label', showing ? 'Показать пароль' : 'Скрыть пароль');
      });
    });

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
      const tracked = window.LNOrder.getAll();

      if (!tracked.length) {
        ordersEl.innerHTML = '<p class="account-orders-empty">У вас пока нет заказов — загляните в <a href="catalog.html" class="account-order-link">каталог</a>, чтобы выбрать первую вещь.</p>';
        return;
      }

      // Most recently submitted shirt as the teaser — the full grid
      // (or single-shirt track) lives on order.html itself.
      const item = tracked.slice().sort((a, b) => b.submittedAt - a.submittedAt)[0];
      const otherCount = tracked.length - 1;
      ordersEl.innerHTML =
        '<div class="account-order-card">' +
          '<img class="account-order-image" src="' + item.image + '" alt="' + item.name + '">' +
          '<div>' +
            '<p class="account-order-name">' + item.name + '</p>' +
            '<p class="account-order-meta">' +
              (item.size ? 'Размер ' + item.size + ' · ' : '') +
              formatPrice(item.price) +
              (otherCount > 0 ? ' · ещё ' + otherCount + ' в отслеживании' : '') +
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

    // Step 1 (email + consent) and step 2 (password + confirm) are
    // one <form> with two submit buttons, one per step div — only the
    // visible step's button is a real (non-inert) default submitter,
    // so Enter-to-submit and clicking either button both land here
    // with the right step already showing.
    registerForm.addEventListener('submit', (evt) => {
      evt.preventDefault();

      if (registerStepEmail.hidden === false) {
        const email = registerForm.elements.email;
        const consent = registerForm.elements.consent;
        let firstInvalid = null;

        let emailMsg = '';
        if (!email.value.trim()) emailMsg = 'Пожалуйста, укажите почту';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) emailMsg = 'Проверьте адрес почты — он выглядит некорректно';
        setFieldError(email, 'register-error-email', emailMsg);
        if (emailMsg) firstInvalid = email;

        const consentMsg = consent.checked ? '' : 'Нужно подтвердить согласие на обработку данных';
        setFieldError(consent, 'register-error-consent', consentMsg);
        if (consentMsg && !firstInvalid) firstInvalid = consent;

        if (firstInvalid) {
          firstInvalid.focus();
          return;
        }

        showRegisterStep('password');
        return;
      }

      const password = registerForm.elements.password;
      const password2 = registerForm.elements.password2;
      let firstInvalid = null;

      let passwordMsg = '';
      if (!password.value) passwordMsg = 'Пожалуйста, придумайте пароль';
      else if (password.value.length < 6) passwordMsg = 'Пароль должен быть не короче 6 символов';
      setFieldError(password, 'register-error-password', passwordMsg);
      if (passwordMsg) firstInvalid = password;

      let password2Msg = '';
      if (!password2.value) password2Msg = 'Повторите пароль ещё раз';
      else if (password2.value !== password.value) password2Msg = 'Пароли не совпадают';
      setFieldError(password2, 'register-error-password2', password2Msg);
      if (password2Msg && !firstInvalid) firstInvalid = password2;

      if (firstInvalid) {
        firstInvalid.focus();
        return;
      }

      const email = registerForm.elements.email.value.trim();
      window.LNAccount.register(email, password.value);
      registerForm.reset();
      showRegisterStep('email');
      document.querySelectorAll('.account-password-toggle.is-active').forEach((btn) => btn.classList.remove('is-active'));
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
