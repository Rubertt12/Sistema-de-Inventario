(() => {
  'use strict';

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

    if (/dashboard\.html$/i.test(location.pathname) || document.getElementById('setoresContainer')) {
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
