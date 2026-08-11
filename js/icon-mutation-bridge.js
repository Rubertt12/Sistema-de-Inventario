(() => {
  'use strict';

  if (window.__RRN_ICON_MUTATION_BRIDGE__) return;
  window.__RRN_ICON_MUTATION_BRIDGE__ = true;

  function refresh(root) {
    if (!root || !window.RRN_ICONS?.decorateStatic) return;
    window.RRN_ICONS.decorateStatic(root);
  }

  function boot() {
    if (!document.body || !window.RRN_ICONS) return;

    const observer = new MutationObserver(records => {
      const roots = new Set();

      records.forEach(record => {
        if (record.type === 'characterData') {
          if (record.target?.parentElement) roots.add(record.target.parentElement);
          return;
        }

        if (record.target instanceof Element) roots.add(record.target);
        record.addedNodes.forEach(node => {
          if (node instanceof Element) roots.add(node);
          else if (node.parentElement) roots.add(node.parentElement);
        });
      });

      roots.forEach(refresh);
    });

    observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();