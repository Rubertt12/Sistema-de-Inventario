// Compatibilidade histórica: detalhes e chamados agora são providos por machine-details-v2.js.
// Este arquivo também evita o primeiro render legado completo de setores.js durante o boot.
(() => {
  'use strict';
  window.RRN_LEGACY_CHAMADO_RETIRED = true;

  if (!/dashboard\.html$/i.test(location.pathname) && !document.getElementById('setoresContainer')) return;

  const nativeAddEventListener = document.addEventListener;
  let captured = false;

  document.addEventListener = function(type, listener, options) {
    const isLegacyInventoryBoot = !captured
      && type === 'DOMContentLoaded'
      && typeof listener === 'function'
      && /loadSetoresAndMachines\s*\(/.test(Function.prototype.toString.call(listener));

    if (!isLegacyInventoryBoot) {
      return nativeAddEventListener.call(this, type, listener, options);
    }

    captured = true;
    document.addEventListener = nativeAddEventListener;

    const wrapped = function(...args) {
      const legacyRenderer = window.renderSetores;
      if (typeof legacyRenderer !== 'function') return listener.apply(this, args);

      let suppressed = false;
      const temporaryRenderer = () => { suppressed = true; };
      window.renderSetores = temporaryRenderer;

      try {
        listener.apply(this, args);
      } finally {
        if (window.renderSetores === temporaryRenderer) window.renderSetores = legacyRenderer;
      }

      if (!suppressed) return;
      window.__RRN_INITIAL_LEGACY_RENDER_SKIPPED__ = true;

      // Fallback: se o renderer moderno não conseguir desenhar a tela,
      // recupera o renderer legado em vez de deixar o inventário vazio.
      setTimeout(() => {
        const container = document.getElementById('setoresContainer');
        if (container?.childElementCount) return;
        try { window.renderSetores?.(); } catch (error) {
          console.warn('RRN Manager: fallback do primeiro render falhou.', error);
        }
      }, 2500);
    };

    return nativeAddEventListener.call(document, type, wrapped, options);
  };
})();
