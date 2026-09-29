(() => {
  'use strict';

  if (window.__RRN_THEME_MODE__) return;
  window.__RRN_THEME_MODE__ = true;

  const KEY = 'rrn_theme_mode';
  const DEFAULT_THEME = 'dark';

  const addStylesheet = (href, marker) => {
    if (document.querySelector(`link[${marker}]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute(marker, '1');
    document.head.appendChild(link);
  };

  const addScript = (src, marker) => {
    if (document.querySelector(`script[${marker}]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.setAttribute(marker, '1');
    document.head.appendChild(script);
  };


  function ensureFinalDashboardCascade() {
    const isDashboard = Boolean(document.getElementById('setoresContainer')) || /dashboard\\.html$/i.test(location.pathname);
    if (!isDashboard) return;
    const link = document.querySelector('link[data-rrn-dashboard-light-final]');
    const target = document.body || document.head;
    if (!target) return;
    if (link) {
      if (document.body && link.parentNode !== document.body) document.body.appendChild(link);
      return;
    }
    const finalLink = document.createElement('link');
    finalLink.rel = 'stylesheet';
    finalLink.href = '/style/dashboard-light-final-v2.css?v=20260929-1';
    finalLink.setAttribute('data-rrn-dashboard-light-final', '1');
    target.appendChild(finalLink);
    if (document.body && finalLink.parentNode !== document.body) document.body.appendChild(finalLink);
  }
  function ensureFinalThemeCascade() {
    const link = document.querySelector('link[data-rrn-theme-final-cascade]');
    const target = document.body || document.head;
    if (!target) return;
    if (link) {
      if (link.parentNode !== document.body && document.body) document.body.appendChild(link);
      return;
    }
    const finalLink = document.createElement('link');
    finalLink.rel = 'stylesheet';
    finalLink.href = '/style/theme-final-cascade-v1.css?v=20260929-1';
    finalLink.setAttribute('data-rrn-theme-final-cascade', '1');
    target.appendChild(finalLink);
    if (document.body && finalLink.parentNode !== document.body) document.body.appendChild(finalLink);
  }

  function ensureThemeFixes() {
    addStylesheet('/style/theme-tokens-v3.css?v=20260929-2', 'data-rrn-theme-tokens-v3');
    addStylesheet('/style/dark-mode-v5.css?v=20260929-1', 'data-rrn-dark-mode-v5');
    addStylesheet('/style/theme-consistency-v1.css?v=20260929-2', 'data-rrn-theme-consistency-v1');
    addStylesheet('/style/theme-consistency-final.css?v=20260929-15', 'data-rrn-theme-consistency-final');
    const isDashboard = Boolean(document.getElementById('setoresContainer')) || /dashboard\.html$/i.test(location.pathname);
    if (isDashboard) {
      addStylesheet('/style/dark-inventory-fix.css?v=20260929-1', 'data-rrn-dark-inventory-fix');
      addStylesheet('/style/theme-component-fixes-v2.css?v=20260929-2', 'data-rrn-theme-component-fixes-v2');
      addStylesheet('/style/ui-fixes-v3.css?v=20260817-2', 'data-rrn-ui-fixes-v3');
      addStylesheet('/style/mobile-modals-v11.css?v=20260817-3', 'data-rrn-mobile-modals-v11');
      addStylesheet('/style/mobile-asset-page-v1.css?v=20260817-1054', 'data-rrn-mobile-asset-page-v1');
      addStylesheet('/style/mobile-core-modals-v1.css?v=20260817-1110', 'data-rrn-mobile-core-modals-v1');
      addStylesheet('/style/mobile-sector-modal-v1.css?v=20260817-1119', 'data-rrn-mobile-sector-modal-v1');
      addStylesheet('/style/modal-system-v1.css?v=20260817-1123', 'data-rrn-modal-system-v1');
      addScript('/js/mobile-modal-accessibility-guard.js?v=20260817-1', 'data-rrn-mobile-modal-accessibility-guard');
      addScript('/js/mobile-core-modals.js?v=20260817-1110', 'data-rrn-mobile-core-modals');
      addScript('/js/modal-system-v1.js?v=20260817-1123', 'data-rrn-modal-system-v1');
      addScript('/js/map-tile-fallback.js?v=20260817-1000', 'data-rrn-map-tile-fallback');
    }
  }

  function ensureFooter() {
    const path = location.pathname.toLowerCase();
    if (path === '/' || path.endsWith('/index.html')) return;
    addStylesheet('/style/footer-v2.css', 'data-rrn-footer-v2');
    if (window.__RRN_FOOTER_V2__ || document.querySelector('script[data-rrn-footer-v2]')) return;
    const script = document.createElement('script');
    script.src = '/js/footer-v2.js';
    script.async = true;
    script.dataset.rrnFooterV2 = '1';
    document.head.appendChild(script);
  }

  function apply(mode, persist = true) {
    const normalized = mode === 'light' ? 'light' : 'dark';
    ensureThemeFixes();
    ensureFinalThemeCascade();
    ensureFinalDashboardCascade();
    document.documentElement.dataset.theme = normalized;
    if (persist) localStorage.setItem(KEY, normalized);
    document.documentElement.style.colorScheme = normalized;
    syncButtons(normalized);
    window.dispatchEvent(new CustomEvent('rrn:themechange', { detail: { mode: normalized } }));
    return normalized;
  }

  function getPreferred() {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
    return DEFAULT_THEME;
  }

  function syncButtons(mode) {
    document.querySelectorAll('[data-rrn-theme-toggle]').forEach(button => {
      button.setAttribute('aria-pressed', String(mode === 'dark'));
      button.textContent = mode === 'dark' ? 'Modo claro' : 'Modo escuro';
    });
  }

  function toggle() {
    return apply(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  }

  function bindThemeButtons() {
    document.querySelectorAll('[data-rrn-theme-toggle]').forEach(button => {
      if (button.dataset.rrnThemeBound === '1') return;
      button.dataset.rrnThemeBound = '1';
      button.addEventListener('click', toggle);
    });
    syncButtons(document.documentElement.dataset.theme || getPreferred());
  }

  function mountSecurityLink() {
    const dropdown = document.getElementById('userDropdown');
    if (!dropdown || dropdown.querySelector('[data-rrn-security-link]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.rrnSecurityLink = '1';
    button.textContent = '🔐 Segurança / 2FA';
    button.addEventListener('click', event => {
      event.stopPropagation();
      location.href = '/seguranca.html';
    });
    const logout = dropdown.querySelector('.logout-btn,[onclick*="logout"],button[onclick*="sair"]');
    dropdown.insertBefore(button, logout || dropdown.lastElementChild || null);
  }

  function mount() {
    ensureThemeFixes();
    ensureFinalThemeCascade();
    ensureFinalDashboardCascade();
    ensureFooter();
    bindThemeButtons();
    mountSecurityLink();
  }

  ensureThemeFixes();
  ensureFooter();
  apply(getPreferred());

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }

  setTimeout(mountSecurityLink, 350);
  setTimeout(mountSecurityLink, 1100);

  window.RRN_THEME = Object.freeze({
    get: () => document.documentElement.dataset.theme || getPreferred(),
    set: mode => apply(mode),
    toggle
  });
})();