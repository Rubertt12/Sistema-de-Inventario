(() => {
  'use strict';
  if (window.__RRN_SECURITY_CENTER_BOOTSTRAP_V2__) return;
  window.__RRN_SECURITY_CENTER_BOOTSTRAP_V2__ = true;
  if (!/configuracoes\.html$/i.test(location.pathname)) return;

  let loading = false;
  function loadCore() {
    if (loading || window.__RRN_SECURITY_CENTER_CORE_V2__) return;
    loading = true;
    const script = document.createElement('script');
    script.src = '/js/security-center-core-v2.js';
    script.async = false;
    script.dataset.rrnSecurityCenterCore = '1';
    script.onerror = () => {
      loading = false;
      console.warn('RRN Security Center: falha ao carregar o módulo principal.');
    };
    document.head.appendChild(script);
  }

  if (window.RRN_SESSION?.userId) {
    loadCore();
    return;
  }

  window.addEventListener('rrn:session-ready', () => setTimeout(loadCore, 0), { once: true });
  setTimeout(() => {
    if (window.RRN_SESSION?.userId) loadCore();
  }, 1800);
})();
