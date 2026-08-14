(() => {
  'use strict';
  if (window.__RRN_NAV_LABEL_FIX__) return;
  window.__RRN_NAV_LABEL_FIX__ = true;

  const labels = {
    dashboard: 'Visão Geral',
    inventory: 'Inventário',
    stock: 'Máquinas em estoque'
  };

  function injectStyle() {
    if (document.getElementById('rrn-nav-label-fix-style')) return;
    const style = document.createElement('style');
    style.id = 'rrn-nav-label-fix-style';
    style.textContent = `
      .rrn-app-tab[data-app-tab]{font-size:.72rem!important}
      .rrn-app-tab[data-app-tab]::after{content:none!important;display:none!important}
    `;
    document.head.appendChild(style);
  }

  function repair() {
    injectStyle();
    document.querySelectorAll('.rrn-app-tab[data-app-tab]').forEach(button => {
      const label = labels[button.dataset.appTab];
      if (!label) return;
      const icon = button.querySelector(':scope > .rrn-icon');
      if (icon) {
        const existingText = Array.from(button.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
        if (existingText) existingText.textContent = ` ${label}`;
        else button.appendChild(document.createTextNode(` ${label}`));
        Array.from(button.childNodes)
          .filter(node => node.nodeType === Node.TEXT_NODE && node !== existingText)
          .forEach(node => node.remove());
      } else if (button.textContent.trim() !== label) {
        button.textContent = label;
      }
    });
  }

  repair();
  document.addEventListener('DOMContentLoaded', repair, { once:true });
  window.addEventListener('load', repair, { once:true });
  const observer = new MutationObserver(() => repair());
  observer.observe(document.documentElement, { childList:true, subtree:true });
  setTimeout(() => observer.disconnect(), 12000);
})();
