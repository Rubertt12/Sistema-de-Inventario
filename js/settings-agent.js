(() => {
  'use strict';
  // Módulo legado de UI permanece desativado. A tela principal é mantida por
  // settings-agent-v2.js; este arquivo carrega apenas o bridge do instalador nativo.
  window.__RRN_SETTINGS_AGENT__ = true;

  if (!/\/configuracoes\.html$/i.test(location.pathname)) return;
  if (document.querySelector('script[data-rrn-agent-installer-v3]')) return;

  const script = document.createElement('script');
  script.src = '/js/settings-agent-installer-v3.js?v=20260814-1';
  script.async = true;
  script.dataset.rrnAgentInstallerV3 = '1';
  document.head.appendChild(script);
})();
