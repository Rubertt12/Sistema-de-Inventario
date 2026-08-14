(() => {
  'use strict';
  if (window.__RRN_SECURITY_CENTER_BOOTSTRAP_V2__) return;
  window.__RRN_SECURITY_CENTER_BOOTSTRAP_V2__ = true;
  if (!/configuracoes\.html$/i.test(location.pathname)) return;

  let loading = false;
  function appendScript(src, marker) {
    if (document.querySelector(`script[data-${marker}]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.setAttribute(`data-${marker}`,'1');
    document.head.appendChild(script);
  }

  function loadCore() {
    if (loading || window.__RRN_SECURITY_CENTER_CORE_V2__) return;
    loading = true;
    appendScript('/js/security-center-core-v2.js','rrn-security-center-core');
    appendScript('/js/support-bot-settings.js','rrn-support-bot-settings');
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
