(() => {
  'use strict';
  if (window.__RRN_MOBILE_INFO_MODAL_RESET__) return;
  window.__RRN_MOBILE_INFO_MODAL_RESET__ = true;

  let resetUntil = 0;

  function panel() {
    return document.querySelector('#infoModal > .modal-content');
  }

  function isOpen() {
    const modal = document.getElementById('infoModal');
    return Boolean(modal && modal.getAttribute('aria-hidden') === 'false');
  }

  function forceTop() {
    if (!window.matchMedia?.('(max-width: 700px)').matches || !isOpen()) return;
    const modal = document.getElementById('infoModal');
    const content = panel();
    if (!modal || !content) return;
    modal.scrollTop = 0;
    content.scrollTop = 0;
    content.scrollTo?.({ top: 0, left: 0, behavior: 'auto' });
  }

  function beginResetWindow() {
    resetUntil = performance.now() + 1200;
    forceTop();
    requestAnimationFrame(forceTop);
    [40, 100, 220, 420, 700, 1050].forEach(ms => setTimeout(forceTop, ms));
  }

  function boot() {
    const modal = document.getElementById('infoModal');
    if (!modal) return;

    new MutationObserver(records => {
      if (records.some(record => record.attributeName === 'aria-hidden') && isOpen()) beginResetWindow();
    }).observe(modal, { attributes: true, attributeFilter: ['aria-hidden'] });

    const contentObserver = new MutationObserver(() => {
      if (performance.now() < resetUntil) forceTop();
    });
    contentObserver.observe(modal, { childList: true, subtree: true });

    document.addEventListener('click', event => {
      if (event.target.closest?.('[onclick*="showInfo("], [data-rrn-info], .rrn-info-btn, .rrn-machine-item button')) {
        setTimeout(() => { if (isOpen()) beginResetWindow(); }, 0);
      }
    }, true);

    window.addEventListener('rrn:machine-location-rendered', () => {
      if (performance.now() < resetUntil) forceTop();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
