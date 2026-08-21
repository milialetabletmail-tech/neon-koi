/* ============================================================
   SIZE TABLE MODAL — shared by product.html and catalog.html's size
   modal. Any button carrying [data-size-table-toggle] opens the same
   static #size-table-modal markup (see both pages), so the two
   pickers link to it without duplicating this wiring.
   ============================================================ */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('size-table-modal');
    if (!modal) return;

    const backdrop = document.getElementById('size-table-backdrop');
    const closeBtn = document.getElementById('size-table-close');
    const toggles = document.querySelectorAll('[data-size-table-toggle]');

    function open() {
      modal.hidden = false;
      document.body.classList.add('size-table-open');
    }

    function close() {
      modal.hidden = true;
      document.body.classList.remove('size-table-open');
    }

    toggles.forEach((btn) => btn.addEventListener('click', open));
    backdrop.addEventListener('click', close);
    closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !modal.hidden) close();
    });
  });
})();
