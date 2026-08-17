(() => {
  'use strict';
  if (window.__RRN_MOBILE_MODALS_AUTHORITY__) return;
  window.__RRN_MOBILE_MODALS_AUTHORITY__ = true;

  const marker = 'data-rrn-mobile-modals-v11';
  let scheduled = false;

  function stylesheet() {
    return document.querySelector(`link[${marker}]`);
  }

  function ensureLast() {
    scheduled = false;
    if (!window.matchMedia?.('(max-width: 700px)').matches) return;
    const link = stylesheet();
    if (!link || !document.head) return;

    const styleNodes = [...document.head.children].filter(node =>
      node === link || node.tagName === 'STYLE' || (node.tagName === 'LINK' && node.rel === 'stylesheet')
    );
    if (styleNodes.at(-1) !== link) document.head.appendChild(link);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(ensureLast);
  }

  function boot() {
    const observer = new MutationObserver(records => {
      if (records.some(record => [...record.addedNodes].some(node =>
        node instanceof Element && (node.tagName === 'STYLE' || (node.tagName === 'LINK' && node.rel === 'stylesheet'))
      ))) schedule();
    });
    observer.observe(document.head, { childList: true });

    [0, 100, 300, 700, 1500, 3000, 5000].forEach(ms => setTimeout(ensureLast, ms));
    window.addEventListener('load', ensureLast, { once: true });
    window.addEventListener('rrn:themechange', schedule);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
