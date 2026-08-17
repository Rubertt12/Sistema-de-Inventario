(() => {
  'use strict';
  if (window.__RRN_MOBILE_CORE_MODALS__) return;
  window.__RRN_MOBILE_CORE_MODALS__ = true;

  const isMobile = () => Boolean(window.matchMedia?.('(max-width: 700px)').matches);

  function openHosts() {
    return [...document.querySelectorAll('.rrn-history-modal.is-open, .rrn-mobile-asset-page')];
  }

  function syncBodyLock() {
    const active = isMobile() && openHosts().length > 0;
    document.documentElement.classList.toggle('rrn-phone-dialog-open', active);
    document.body.classList.toggle('rrn-phone-dialog-open', active);
  }

  function resetHistorySheet(host) {
    if (!isMobile() || !host?.classList.contains('is-open')) return;
    const body = host.querySelector('.rrn-history-body');
    if (body) {
      body.scrollTop = 0;
      requestAnimationFrame(() => { if (host.classList.contains('is-open')) body.scrollTop = 0; });
    }
  }

  function resetDetailsSheet(page) {
    if (!isMobile() || !page?.classList.contains('rrn-mobile-asset-page')) return;
    const panel = page.querySelector(':scope > .modal-content');
    if (panel) {
      panel.scrollTop = 0;
      requestAnimationFrame(() => { if (page.isConnected) panel.scrollTop = 0; });
    }
  }

  function handleNode(node) {
    if (!(node instanceof Element)) return;
    if (node.matches('.rrn-mobile-asset-page')) resetDetailsSheet(node);
    node.querySelectorAll?.('.rrn-mobile-asset-page').forEach(resetDetailsSheet);
  }

  function boot() {
    const observer = new MutationObserver(records => {
      let needsSync = false;
      for (const record of records) {
        if (record.type === 'attributes' && record.target.classList?.contains('rrn-history-modal')) {
          if (record.target.classList.contains('is-open')) resetHistorySheet(record.target);
          needsSync = true;
        }
        record.addedNodes?.forEach(node => { handleNode(node); needsSync = true; });
        if (record.removedNodes?.length) needsSync = true;
      }
      if (needsSync) syncBodyLock();
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class']
    });

    document.querySelectorAll('.rrn-history-modal.is-open').forEach(resetHistorySheet);
    document.querySelectorAll('.rrn-mobile-asset-page').forEach(resetDetailsSheet);
    syncBodyLock();

    window.addEventListener('resize', syncBodyLock);
    window.visualViewport?.addEventListener('resize', syncBodyLock);
    window.addEventListener('pageshow', syncBodyLock);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
