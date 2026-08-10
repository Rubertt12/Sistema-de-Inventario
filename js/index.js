(() => {
  'use strict';

  const isDashboard = /dashboard\.html$/i.test(location.pathname) || Boolean(document.getElementById('setoresContainer'));
  const legacyCredentialKeys = new Set(['usuarios', 'users', 'rememberedUser', 'rememberedPass', 'loggedUser']);

  function ensureDashboardStyle() {
    if (!isDashboard || document.querySelector('link[data-rrn-enterprise]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/style/enterprise.css';
    link.dataset.rrnEnterprise = '1';
    document.head.appendChild(link);
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

  // Executa antes dos scripts inline legados do dashboard.
  ensureDashboardStyle();
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
