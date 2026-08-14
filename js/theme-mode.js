(() => {
  'use strict';

  if (window.__RRN_THEME_MODE__) return;
  window.__RRN_THEME_MODE__ = true;

  const KEY = 'rrn_theme_mode';

  function addStylesheet(href, marker) {
    if (document.querySelector(`link[${marker}]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute(marker, '1');
    document.head.appendChild(link);
  }

  function ensureThemeFixes() {
    addStylesheet('/style/dark-mode-v4.css', 'data-rrn-dark-mode-v4');
    const isDashboard = Boolean(document.getElementById('setoresContainer')) || /dashboard\.html$/i.test(location.pathname);
    if (isDashboard) addStylesheet('/style/dark-inventory-fix.css', 'data-rrn-dark-inventory-fix');
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

  function loadMfaGuard() {
    if (document.querySelector('script[data-rrn-mfa-guard]')) return;
    const script = document.createElement('script');
    script.src = '/js/mfa-guard.js';
    script.async = true;
    script.dataset.rrnMfaGuard = '1';
    document.head.appendChild(script);
  }

  function ensureMfaGuard() {
    if (window.__RRN_MFA_TRUSTED_DEVICE__ || document.querySelector('script[data-rrn-mfa-trusted]')) {
      if (window.__RRN_MFA_TRUSTED_DEVICE__) loadMfaGuard();
      else document.querySelector('script[data-rrn-mfa-trusted]')?.addEventListener('load', loadMfaGuard, { once: true });
      return;
    }
    const trusted = document.createElement('script');
    trusted.src = '/js/mfa-trusted-device.js';
    trusted.async = false;
    trusted.dataset.rrnMfaTrusted = '1';
    trusted.onload = loadMfaGuard;
    trusted.onerror = loadMfaGuard;
    document.head.appendChild(trusted);
  }

  function preferred() {
    const saved = localStorage.getItem(KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function syncButtons(mode) {
    document.querySelectorAll('[data-rrn-theme-toggle]').forEach(button => {
      button.setAttribute('aria-pressed', String(mode === 'dark'));
      button.textContent = mode === 'dark' ? 'Modo claro' : 'Modo escuro';
    });
  }

  function apply(mode) {
    const normalized = mode === 'dark' ? 'dark' : 'light';
    ensureThemeFixes();
    document.documentElement.dataset.theme = normalized;
    localStorage.setItem(KEY, normalized);
    syncButtons(normalized);
    window.dispatchEvent(new CustomEvent('rrn:themechange', { detail: { mode: normalized } }));
  }

  function toggle() {
    apply(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  }

  function bindExistingButtons() {
    document.querySelectorAll('[data-rrn-theme-toggle]').forEach(button => {
      if (button.dataset.rrnThemeBound === '1') return;
      button.dataset.rrnThemeBound = '1';
      button.addEventListener('click', toggle);
    });
  }

  function makeButton(extra = '') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `rrn-theme-toggle ${extra}`.trim();
    button.setAttribute('data-rrn-theme-toggle', '1');
    button.setAttribute('aria-label', 'Alternar tema claro e escuro');
    button.dataset.rrnThemeBound = '1';
    button.addEventListener('click', toggle);
    return button;
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
    ensureFooter();
    mountSecurityLink();
    bindExistingButtons();
    if (document.querySelector('[data-rrn-theme-toggle]')) {
      syncButtons(document.documentElement.dataset.theme || preferred());
      return;
    }

    const dropdown = document.getElementById('userDropdown');
    if (dropdown) {
      const button = makeButton();
      dropdown.insertBefore(button, dropdown.firstChild);
      syncButtons(document.documentElement.dataset.theme || preferred());
      return;
    }

    const topbar = document.querySelector('.topbar');
    if (topbar) {
      const button = makeButton();
      topbar.insertBefore(button, topbar.lastElementChild);
      syncButtons(document.documentElement.dataset.theme || preferred());
      return;
    }

    if (document.querySelector('.auth-shell')) {
      document.body.appendChild(makeButton('rrn-theme-toggle--floating'));
      syncButtons(document.documentElement.dataset.theme || preferred());
    }
  }

  ensureThemeFixes();
  ensureFooter();
  apply(preferred());
  ensureMfaGuard();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }

  setTimeout(mountSecurityLink, 350);
  setTimeout(mountSecurityLink, 1100);

  window.RRN_THEME = {
    get: () => document.documentElement.dataset.theme,
    set: apply,
    toggle
  };
})();