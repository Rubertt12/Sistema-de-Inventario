(() => {
  'use strict';
  if (window.__RRN_MOBILE_INFO_MODAL_RESET__) return;
  window.__RRN_MOBILE_INFO_MODAL_RESET__ = true;

  function reset() {
    if (!window.matchMedia?.('(max-width: 700px)').matches) return;
    const modal = document.getElementById('infoModal');
    const panel = modal?.querySelector(':scope > .modal-content');
    if (!modal || !panel || modal.getAttribute('aria-hidden') !== 'false') return;
    modal.scrollTop = 0;
    panel.scrollTop = 0;
    requestAnimationFrame(() => {
      modal.scrollTop = 0;
      panel.scrollTop = 0;
    });
    setTimeout(() => {
      modal.scrollTop = 0;
      panel.scrollTop = 0;
    }, 80);
  }

  function boot() {
    const modal = document.getElementById('infoModal');
    if (!modal) return;
    new MutationObserver(records => {
      if (records.some(record => record.attributeName === 'aria-hidden')) reset();
    }).observe(modal, { attributes: true, attributeFilter: ['aria-hidden'] });

    document.addEventListener('click', event => {
      if (event.target.closest?.('[onclick*="showInfo("], [data-rrn-info], .rrn-info-btn')) {
        setTimeout(reset, 0);
      }
    }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
