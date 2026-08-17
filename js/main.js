// RRN Manager — arquivo mantido por compatibilidade histórica e pequenos hotfixes globais.
//
// A autenticação antiga em localStorage foi removida. Login, cadastro e sessão
// são responsabilidade de auth-v2.js / tenant-runtime.js.
//
// A importação de equipamentos por query string também é tratada por
// js/script.js.
(() => {
  'use strict';
  window.RRN_LEGACY_MAIN_RETIRED = true;

  function installInfoModalViewportFix() {
    if (document.getElementById('rrn-info-modal-viewport-fix')) return;

    const style = document.createElement('style');
    style.id = 'rrn-info-modal-viewport-fix';
    style.textContent = `
      html.rrn-info-modal-open,
      body.rrn-info-modal-open {
        overflow: hidden !important;
        overscroll-behavior: none;
      }

      #infoModal.modal {
        position: fixed !important;
        inset: 0 !important;
        top: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        left: 0 !important;
        width: auto !important;
        height: auto !important;
        min-width: 0 !important;
        min-height: 100vh !important;
        min-height: 100dvh !important;
        max-width: none !important;
        max-height: none !important;
        margin: 0 !important;
        padding: clamp(12px, 2vw, 24px) !important;
        box-sizing: border-box !important;
        align-items: center !important;
        justify-content: center !important;
        overflow: auto !important;
        overscroll-behavior: contain;
        background: rgba(12, 22, 30, .72) !important;
        backdrop-filter: blur(5px);
        -webkit-backdrop-filter: blur(5px);
        z-index: 1600 !important;
      }

      #infoModal > .modal-content {
        position: relative !important;
        width: min(900px, calc(100vw - 32px)) !important;
        max-width: 900px !important;
        max-height: calc(100vh - 32px) !important;
        max-height: calc(100dvh - 32px) !important;
        margin: auto !important;
        overflow-x: hidden !important;
        overflow-y: auto !important;
        overscroll-behavior: contain;
      }

      #infoModal .close-btn {
        top: 12px !important;
        right: 12px !important;
        margin-top: 0 !important;
        z-index: 5 !important;
      }

      @media (max-width: 640px) {
        #infoModal.modal {
          padding: 8px !important;
          align-items: flex-start !important;
        }

        #infoModal > .modal-content {
          width: calc(100vw - 16px) !important;
          max-height: calc(100vh - 16px) !important;
          max-height: calc(100dvh - 16px) !important;
          padding: 24px 16px 20px !important;
        }
      }
    `;
    document.head.appendChild(style);

    const modal = document.getElementById('infoModal');
    if (!modal) return;

    const syncScrollLock = () => {
      const inlineDisplay = modal.style.display;
      const isOpen = modal.getAttribute('aria-hidden') !== 'true'
        && inlineDisplay !== 'none'
        && getComputedStyle(modal).display !== 'none';
      document.documentElement.classList.toggle('rrn-info-modal-open', isOpen);
      document.body.classList.toggle('rrn-info-modal-open', isOpen);
    };

    const observer = new MutationObserver(syncScrollLock);
    observer.observe(modal, {
      attributes: true,
      attributeFilter: ['style', 'class', 'aria-hidden']
    });
    syncScrollLock();

    window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installInfoModalViewportFix, { once: true });
  } else {
    installInfoModalViewportFix();
  }
})();
