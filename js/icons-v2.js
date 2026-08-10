(() => {
  'use strict';

  if (window.RRN_ICONS) return;

  const NS = 'http://www.w3.org/2000/svg';
  const paths = {
    dashboard: ['M3 3h7v7H3z','M14 3h7v4h-7z','M14 11h7v10h-7z','M3 14h7v7H3z'],
    inventory: ['M4 7.5 12 3l8 4.5v9L12 21l-8-4.5z','M4.5 7.5 12 12l7.5-4.5','M12 12v9'],
    monitor: ['M3 4h18v12H3z','M8 20h8','M12 16v4'],
    building: ['M4 21V4h10v17','M14 9h6v12','M8 8h2','M8 12h2','M8 16h2','M17 13h1','M17 17h1'],
    wrench: ['M14.7 6.3a4 4 0 0 0-5-5l2.1 2.1-2.8 2.8-2.1-2.1a4 4 0 0 0 5 5L5 18.2A2 2 0 1 0 7.8 21l6.9-6.9a4 4 0 0 0 5-5l-2.1 2.1-2.8-2.8 2.1-2.1a4 4 0 0 0-5 0z'],
    shield: ['M12 3 20 6v5c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6z','m9 12 2 2 4-4'],
    plus: ['M12 5v14','M5 12h14'],
    transfer: ['M7 7h12','m15 4 4 3-4 3','M17 17H5','m9 20-4-3 4-3'],
    settings: ['M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z','M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.04 1.57V20.3h-3V20.2a1.7 1.7 0 0 0-1.04-1.57 1.7 1.7 0 0 0-1.88.34l-.06.06-2.12-2.12.06-.06A1.7 1.7 0 0 0 7 15a1.7 1.7 0 0 0-1.57-1.04H5.3v-3h.1A1.7 1.7 0 0 0 7 9.92a1.7 1.7 0 0 0-.34-1.88L6.6 8l2.12-2.12.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 11.7 4.7v-.1h3v.1a1.7 1.7 0 0 0 1.04 1.57 1.7 1.7 0 0 0 1.88-.34l.06-.06L19.8 8l-.06.06a1.7 1.7 0 0 0-.34 1.88A1.7 1.7 0 0 0 20.97 11h.13v3h-.1A1.7 1.7 0 0 0 19.4 15z'],
    users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2','M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z','M22 21v-2a4 4 0 0 0-3-3.87','M16 3.13a4 4 0 0 1 0 7.75'],
    trash: ['M3 6h18','M8 6V4h8v2','M19 6l-1 15H6L5 6','M10 11v6','M14 11v6'],
    logout: ['M10 17l5-5-5-5','M15 12H3','M21 19V5a2 2 0 0 0-2-2h-6'],
    download: ['M12 3v12','m7 10 5 5 5-5','M5 21h14'],
    upload: ['M12 21V9','m17 14-5-5-5 5','M5 3h14'],
    folder: ['M3 6h7l2 2h9v11H3z'],
    scan: ['M4 7V4h3','M17 4h3v3','M20 17v3h-3','M7 20H4v-3','M8 8h8v8H8z'],
    menu: ['M4 7h16','M4 12h16','M4 17h16'],
    info: ['M12 17v-5','M12 8h.01','M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z'],
    search: ['M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z','m21 21-4.35-4.35']
  };

  function make(name, size = 18) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.9');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('rrn-icon');
    (paths[name] || paths.info).forEach(d => {
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', d);
      svg.appendChild(path);
    });
    return svg;
  }

  function cleanLabel(value) {
    return String(value || '')
      .replace(/^[\s\u2600-\u27BF\u{1F300}-\u{1FAFF}\uFE0F\u200D＋⇄↔]+/u, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function decorate(element, name) {
    if (!element || element.dataset.rrnSvgIcon === name) return;
    const label = cleanLabel(element.textContent);
    element.replaceChildren(make(name), document.createTextNode(label ? ` ${label}` : ''));
    element.dataset.rrnSvgIcon = name;
    element.classList.add('rrn-icon-control');
  }

  const rules = [
    ['.rrn-app-tab[data-app-tab="dashboard"]', 'dashboard'],
    ['.rrn-app-tab[data-app-tab="inventory"]', 'inventory'],
    ['[data-home-action="inventory"]', 'inventory'],
    ['[data-home-action="add"]', 'plus'],
    ['[data-home-action="transfer"]', 'transfer'],
    ['.rrn-kpi:nth-child(1) .rrn-kpi-icon', 'monitor'],
    ['.rrn-kpi:nth-child(2) .rrn-kpi-icon', 'building'],
    ['.rrn-kpi:nth-child(3) .rrn-kpi-icon', 'wrench'],
    ['.rrn-kpi:nth-child(4) .rrn-kpi-icon', 'shield'],
    ['#addSetorBtn', 'plus'],
    ['button[onclick*="abrirModalTransferencia"]', 'transfer'],
    ['button[onclick*="openConfigModal"]', 'settings'],
    ['button[onclick*="abrirPaginaUsuarios"]', 'users'],
    ['.excluir-tudo-btn', 'trash'],
    ['.logout-btn', 'logout'],
    ['button[onclick*="exportarBackupJSON"]', 'download'],
    ['button[onclick*="jsonInput"]', 'upload'],
    ['button[onclick*="importFromCSVButton"]', 'upload'],
    ['button[onclick*="exportToCSV"]', 'download'],
    ['label[for="bgImageUpload"]', 'folder'],
    ['button[onclick*="abrirScanner"]', 'scan'],
    ['.menu-toggle', 'menu']
  ];

  function decorateStatic(root = document) {
    rules.forEach(([selector, name]) => root.querySelectorAll(selector).forEach(el => decorate(el, name)));
  }

  function boot() {
    decorateStatic();
    const observer = new MutationObserver(records => {
      let changed = false;
      for (const record of records) {
        if (record.addedNodes.length) { changed = true; break; }
      }
      if (changed) decorateStatic();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.RRN_ICONS = Object.freeze({ make, decorate, decorateStatic });
})();