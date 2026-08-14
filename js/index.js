(() => {
  'use strict';

  const isDashboard = /dashboard\.html$/i.test(location.pathname) || Boolean(document.getElementById('setoresContainer'));
  const legacyCredentialKeys = new Set(['usuarios', 'users', 'rememberedUser', 'rememberedPass', 'loggedUser']);

  function addStylesheet(href, marker) {
    if (!isDashboard || document.querySelector(`link[${marker}]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute(marker, '1');
    document.head.appendChild(link);
  }

  function ensureDashboardStyles() {
    addStylesheet('/style/enterprise.css', 'data-rrn-enterprise');
    addStylesheet('/style/dashboard-ui.css', 'data-rrn-dashboard-ui');
    addStylesheet('/style/dashboard-tabs.css', 'data-rrn-dashboard-tabs');
    addStylesheet('/style/dashboard-admin-tools.css', 'data-rrn-dashboard-admin-tools');
    addStylesheet('/style/grid-machine-details.css', 'data-rrn-grid-machine-details');
    addStylesheet('/style/asset-history.css', 'data-rrn-asset-history');
    addStylesheet('/style/backend-status.css', 'data-rrn-backend-status');
    addStylesheet('/style/trash.css', 'data-rrn-trash');
    addStylesheet('/style/search-center-v2.css', 'data-rrn-search-center-v2');
    addStylesheet('/style/maintenance-drawer-v2.css', 'data-rrn-maintenance-drawer-v2');
    addStylesheet('/style/color-coherence-v3.css', 'data-rrn-color-coherence-v3');
  }

  function ensureBrandTheme() {
    if (document.querySelector('link[data-rrn-theme-v2]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/style/rrn-theme-v2.css';
    link.setAttribute('data-rrn-theme-v2', '1');
    document.head.appendChild(link);
  }

  function ensureTypography() {
    if (document.querySelector('link[data-rrn-typography-v2]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/style/typography-v2.css';
    link.setAttribute('data-rrn-typography-v2', '1');
    document.head.appendChild(link);
  }

  function ensureFooterStyles() {
    if (document.querySelector('link[data-rrn-footer-v2]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/style/footer-v2.css';
    link.setAttribute('data-rrn-footer-v2', '1');
    document.head.appendChild(link);
  }

  function containsPlaintextPassword(value) {
    try {
      const parsed = JSON.parse(value);
      return Boolean(parsed && typeof parsed === 'object' && ('senha' in parsed || 'password' in parsed));
    } catch { return false; }
  }

  function guardLegacyCredentials() {
    if (!isDashboard || window.__RRN_LEGACY_CREDENTIAL_GUARD__) return;
    window.__RRN_LEGACY_CREDENTIAL_GUARD__ = true;
    legacyCredentialKeys.forEach(key => { localStorage.removeItem(key); sessionStorage.removeItem(key); });
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      const normalizedKey = String(key);
      if (this === localStorage && legacyCredentialKeys.has(normalizedKey)) return;
      if (this === localStorage && normalizedKey === 'usuarioLogado' && containsPlaintextPassword(value)) return;
      return originalSetItem.call(this, key, value);
    };
  }

  function currentRole() {
    if (window.RRN_SESSION?.role) return window.RRN_SESSION.role;
    try { return JSON.parse(localStorage.getItem('usuarioLogado') || '{}').perfil || null; } catch { return null; }
  }

  window.verificarPermissoes = function verificarPermissoes() {
    const role = currentRole();
    const adminMenu = document.getElementById('adminMenu');
    const addSetor = document.getElementById('addSetorBtn');
    const deleteAll = document.querySelector('.excluir-tudo-btn');
    const canOperate = role === 'admin' || role === 'operador' || role == null;
    if (adminMenu) adminMenu.style.display = role === 'admin' ? 'block' : 'none';
    if (addSetor) addSetor.style.display = canOperate ? '' : 'none';
    if (deleteAll) deleteAll.style.display = role === 'admin' ? '' : 'none';
  };

  function cleanupLegacyMarkup() {
    if (!isDashboard) return;
    const configModal = document.getElementById('configModal');
    const saveButton = document.querySelector('.save-btn');
    if (configModal && saveButton && !configModal.contains(saveButton)) configModal.appendChild(saveButton);
    window.verificarPermissoes();
  }

  ensureDashboardStyles();
  ensureBrandTheme();
  addStylesheet('/style/settings-v2.css', 'data-rrn-settings-v2');
  addStylesheet('/style/settings-layout-v4.css', 'data-rrn-settings-layout-v4');
  ensureTypography();
  ensureFooterStyles();
  guardLegacyCredentials();

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', cleanupLegacyMarkup, { once: true });
  else cleanupLegacyMarkup();

  const load = src => new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-rrn-src="${src}"]`)) return resolve();
    const script = document.createElement('script');
    script.src = src; script.async = false; script.dataset.rrnSrc = src;
    script.onload = resolve; script.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
    document.head.appendChild(script);
  });

  (async () => {
    if (!window.RRN_SUPABASE) await load('/js/supabase-config.js');
    await load('/js/theme-mode.js');
    await load('/js/footer-v2.js');
    await load('/js/preview-demo.js');
    window.verificarPermissoes?.();
    if (isDashboard && window.RRN_PREVIEW_DEMO) { window.loadSetoresAndMachines?.(); window.renderSetores?.(); }

    if (isDashboard) {
      await load('/js/icons-v2.js');
      await load('/js/icon-mutation-bridge.js');
      await load('/js/dashboard-ui.js');
      await load('/js/support-desk-link.js');
      await load('/js/settings-v2.js');
      await load('/js/maintenance-panel.js');
      await load('/js/scanner.js');
      await load('/js/transfer-v2.js');
      await load('/js/machine-details-v2.js');
      await load('/js/ticket-author-bridge.js');
      await load('/js/asset-history.js');
      await load('/js/dashboard-hotfix.js');
      await load('/js/equipment-list-performance.js');
      await load('/js/sector-category-guard.js');
      await load('/js/trash-v2.js');
      await load('/js/trash-audit-bridge.js');
      await load('/js/backup-v3.js');
      await load('/js/reports-v2.js');
      await load('/js/profile-picture-v2.js');
      await load('/js/production-stability.js');
      await load('/js/grid-machine-details.js');
      await load('/js/compact-grid-actions.js');
      await load('/js/user-asset-linking.js');
      await load('/js/responsible-autocomplete.js');
      await load('/js/dashboard-tabs.js');
      await load('/js/navbar-v5.js');
      await load('/js/search-center-v2.js');
      await load('/js/dashboard-quality-fixes.js');
      await load('/js/service-desk-inventory-bridge.js');
    }

    if (!window.supabase?.createClient) await load('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
    await load('/js/tenant-branding-runtime.js');

    if (document.getElementById('formLogin')) {
      await load('/js/tenant-login-context.js');
      await window.RRN_TENANT_LOGIN_READY;
      await load('/js/auth-v2.js');
      window.RRN_PREVIEW?.seed?.(false);
      return;
    }

    if (isDashboard) {
      await load('/js/tenant-runtime.js');
      await load('/js/remote-inventory-sync.js');
      await load('/js/backend-v2.js');
      await load('/js/backend-status.js');
      await load('/js/password-management.js');
      await load('/js/dashboard-customize.js');
      await load('/js/inventory-snapshots.js');
      window.verificarPermissoes?.();
      window.RRN_UI?.updateOverview?.();
      window.RRN_TABS?.renderHome?.();
      window.RRN_DASHBOARD_CUSTOMIZE?.refresh?.();
      window.RRN_INVENTORY_SNAPSHOTS?.refresh?.();
      window.RRN_ICONS?.decorateStatic?.();
      window.RRN_GRID_DETAILS?.enhanceAll?.();
      window.RRN_COMPACT_ACTIONS?.enhance?.();
      window.RRN_USER_ASSETS?.refreshCards?.();
      window.RRN_RESPONSIBLE_AUTOCOMPLETE?.refresh?.();
    }
  })().catch(error => {
    console.error('Falha ao inicializar o RRN Manager:', error);
    const notice = document.getElementById('backendNotice');
    if (notice) { notice.hidden = false; notice.textContent = error.message || 'Falha ao iniciar o backend.'; }
  });
})();
