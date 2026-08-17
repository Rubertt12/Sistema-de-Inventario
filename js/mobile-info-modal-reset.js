(() => {
  'use strict';
  if (window.__RRN_MOBILE_INFO_MODAL_RESET__) return;
  window.__RRN_MOBILE_INFO_MODAL_RESET__ = true;

  let keepPinnedUntil = 0;
  let userInteracted = false;
  let rafId = 0;

  function panel() {
    return document.querySelector('#infoModal > .modal-content');
  }

  function modal() {
    return document.getElementById('infoModal');
  }

  function isMobile() {
    return Boolean(window.matchMedia?.('(max-width: 700px)').matches);
  }

  function isOpen() {
    const host = modal();
    return Boolean(host && host.getAttribute('aria-hidden') === 'false');
  }

  function forceTop() {
    if (!isMobile() || !isOpen() || userInteracted) return;
    const host = modal();
    const content = panel();
    if (!host || !content) return;
    host.scrollTop = 0;
    content.scrollTop = 0;
    content.scrollTo?.(0, 0);
  }

  function pinLoop() {
    cancelAnimationFrame(rafId);
    const tick = () => {
      if (!isOpen() || userInteracted || performance.now() >= keepPinnedUntil) return;
      forceTop();
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  }

  function beginResetWindow() {
    if (!isMobile()) return;
    userInteracted = false;
    keepPinnedUntil = performance.now() + 5000;
    forceTop();
    pinLoop();
    [30, 80, 150, 300, 600, 1000, 1600, 2400, 3400, 4600].forEach(ms => setTimeout(forceTop, ms));
  }

  function markUserInteraction(event) {
    if (!isOpen()) return;
    const content = panel();
    if (!content) return;
    if (event.type === 'keydown' && !['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(event.key)) return;
    userInteracted = true;
    cancelAnimationFrame(rafId);
  }

  function boot() {
    const host = modal();
    if (!host) return;

    new MutationObserver(records => {
      if (records.some(record => record.attributeName === 'aria-hidden') && isOpen()) beginResetWindow();
    }).observe(host, { attributes: true, attributeFilter: ['aria-hidden'] });

    new MutationObserver(() => {
      if (performance.now() < keepPinnedUntil && !userInteracted) forceTop();
    }).observe(host, { childList: true, subtree: true, characterData: true });

    document.addEventListener('click', event => {
      if (event.target.closest?.('[onclick*="showInfo("], [data-rrn-info], .rrn-info-btn, .rrn-machine-item button')) {
        setTimeout(beginResetWindow, 0);
      }
    }, true);

    ['touchstart','pointerdown','wheel','keydown'].forEach(type => {
      host.addEventListener(type, markUserInteraction, { passive: type !== 'keydown', capture: true });
    });

    window.addEventListener('rrn:machine-location-rendered', () => {
      if (performance.now() < keepPinnedUntil && !userInteracted) forceTop();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
