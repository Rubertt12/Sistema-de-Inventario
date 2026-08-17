(() => {
  'use strict';
  if (window.__RRN_MOBILE_MODAL_ACCESSIBILITY_GUARD__) return;
  window.__RRN_MOBILE_MODAL_ACCESSIBILITY_GUARD__ = true;

  function blurInsideInfoModal() {
    const modal = document.getElementById('infoModal');
    const active = document.activeElement;
    if (modal && active instanceof HTMLElement && modal.contains(active)) {
      active.blur();
      try { document.body.focus?.({ preventScroll: true }); } catch {}
    }
  }

  function wrapClose() {
    const original = window.closeModal;
    if (typeof original !== 'function' || original.__rrnA11yWrapped) return false;
    const wrapped = function(...args) {
      blurInsideInfoModal();
      return original.apply(this, args);
    };
    wrapped.__rrnA11yWrapped = true;
    wrapped.__rrnOriginal = original;
    window.closeModal = wrapped;
    return true;
  }

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (wrapClose() || attempts > 80) clearInterval(timer);
  }, 100);

  document.addEventListener('click', event => {
    const close = event.target.closest?.('#infoModal .close-btn, #infoModal .close, #infoModal #close-btn');
    if (close) blurInsideInfoModal();
  }, true);
})();
