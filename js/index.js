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
  }

  function guardLegacyCredentials() {
    if (!isDashboard || window.__RRN_LEGACY_CREDENTIAL_GUARD__) return;
    window.__RRN_LEGACY_CREDENTIAL_GUARD__ = true;

    legacyCredentialKeys.forEach(key => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });

    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (this === localStorage && legacyCredentialKeys.has(String(key))) {
        console.warn(`RRN Manager: armazenamento legado de credencial bloqueado (${key}).`);
        return;
      }
      return originalSetItem.call(this, key, value);
    };
  }

  ensureDashboardStyles();
  guardLegacyCredentials();

  const load = src => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
    document.head.appendChild(script);
  });

  (async () => {
    if (isDashboard) {
      await load('/js/dashboard-ui.js');
    }

    if (!window.RRN_SUPABASE) await load('/js/supabase-config.js');
    if (!window.supabase?.createClient) await load('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');

    if (document.getElementById('formLogin')) {
      await load('/js/auth-v2.js');
      return;
    }

    if (isDashboard) {
      await load('/js/tenant-runtime.js');
    }
  })().catch(error => {
    console.error('Falha ao inicializar o RRN Manager:', error);
    const notice = document.getElementById('backendNotice');
    if (notice) {
      notice.hidden = false;
      notice.textContent = error.message || 'Falha ao iniciar o backend.';
    }
  });
})();
