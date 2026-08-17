(() => {
  'use strict';
  if (window.__RRN_MODAL_SYSTEM_V1__) return;
  window.__RRN_MODAL_SYSTEM_V1__ = true;

  const mobile = () => Boolean(window.matchMedia?.('(max-width: 700px)').matches);
  const selectors = [
    '#modalSetor', '#modalMaquina', '#infoModal', '#modalTodasManutencoes',
    '#modalTransferencia', '#modalScanner', '#configModal', '.rrn-history-modal',
    '.rrn-mobile-asset-page'
  ];

  function visible(el) {
    if (!el || !el.isConnected) return false;
    if (el.hidden) return false;
    if (el.classList.contains('rrn-history-modal')) return el.classList.contains('is-open');
    if (el.classList.contains('rrn-mobile-asset-page')) return true;
    const style = getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }

  function topScroller(el) {
    if (!el) return null;
    if (el.classList.contains('rrn-history-modal')) return el.querySelector('.rrn-history-body') || el.querySelector('.rrn-history-dialog');
    if (el.classList.contains('rrn-mobile-asset-page')) return el.querySelector(':scope > .modal-content');
    if (el.id === 'configModal') return el;
    if (el.id === 'modalTransferencia') return el.querySelector('.modal-transferencia-content');
    if (el.id === 'modalScanner') return el.querySelector(':scope > div');
    return el.querySelector(':scope > .modal-content') || el;
  }

  function resetToTop(el) {
    if (!mobile() || !visible(el)) return;
    const scroller = topScroller(el);
    if (!scroller) return;
    scroller.scrollTop = 0;
    scroller.scrollTo?.(0, 0);
    const nested = el.querySelectorAll('.rrn-history-body, .modal-content, .modal-transferencia-content');
    nested.forEach(node => { if (node !== scroller) node.scrollTop = 0; });
  }

  function syncBodyLock() {
    if (!mobile()) {
      document.documentElement.classList.remove('rrn-any-modal-open');
      document.body.classList.remove('rrn-any-modal-open');
      return;
    }
    const hasOpen = selectors.some(selector => [...document.querySelectorAll(selector)].some(visible));
    document.documentElement.classList.toggle('rrn-any-modal-open', hasOpen);
    document.body.classList.toggle('rrn-any-modal-open', hasOpen);
  }

  function normalize(el) {
    if (!el || !mobile() || !visible(el)) return;
    const active = document.activeElement;
    if (active && !el.contains(active)) active.blur?.();
    requestAnimationFrame(() => {
      resetToTop(el);
      syncBodyLock();
    });
  }

  const observer = new MutationObserver(records => {
    let needsSync = false;
    records.forEach(record => {
      const target = record.target?.nodeType === 1 ? record.target : null;
      if (target) {
        selectors.forEach(selector => {
          if (target.matches?.(selector)) normalize(target);
          target.querySelectorAll?.(selector).forEach(normalize);
        });
      }
      needsSync = true;
    });
    if (needsSync) requestAnimationFrame(syncBodyLock);
  });

  function boot() {
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'hidden', 'aria-hidden']
    });

    selectors.forEach(selector => document.querySelectorAll(selector).forEach(normalize));
    syncBodyLock();

    document.addEventListener('click', event => {
      const trigger = event.target.closest?.('button, a');
      if (!trigger || !mobile()) return;
      setTimeout(() => {
        selectors.forEach(selector => document.querySelectorAll(selector).forEach(el => {
          if (visible(el)) normalize(el);
        }));
      }, 0);
    }, true);

    window.addEventListener('resize', syncBodyLock);
    window.addEventListener('pageshow', () => {
      syncBodyLock();
      selectors.forEach(selector => document.querySelectorAll(selector).forEach(el => {
        if (visible(el)) resetToTop(el);
      }));
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
