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
        padding: clamp(12px, 2vw, 28px) !important;
        box-sizing: border-box !important;
        align-items: center !important;
        justify-content: center !important;
        overflow: auto !important;
        overscroll-behavior: contain;
        background: rgba(12, 22, 30, .76) !important;
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        z-index: 1600 !important;
      }

      #infoModal > .modal-content {
        position: relative !important;
        display: grid !important;
        grid-template-columns: minmax(0, 1.45fr) minmax(340px, .85fr) !important;
        grid-template-rows: auto auto minmax(150px, 1fr) auto auto !important;
        column-gap: 18px !important;
        row-gap: 12px !important;
        width: min(1320px, calc(100vw - 48px)) !important;
        max-width: 1320px !important;
        height: min(860px, calc(100vh - 48px)) !important;
        height: min(860px, calc(100dvh - 48px)) !important;
        max-height: calc(100vh - 48px) !important;
        max-height: calc(100dvh - 48px) !important;
        margin: auto !important;
        padding: 20px !important;
        overflow: hidden !important;
        box-sizing: border-box !important;
        border: 1px solid rgba(41, 89, 145, .18) !important;
        border-radius: 20px !important;
        background: #f6f8fb !important;
        box-shadow: 0 24px 70px rgba(0, 0, 0, .34) !important;
      }

      #infoModal > .modal-content > h2 {
        grid-column: 1 / -1 !important;
        grid-row: 1 !important;
        margin: 0 !important;
        padding: 2px 54px 14px 2px !important;
        color: #24384d !important;
        font-size: clamp(1.05rem, 1.6vw, 1.35rem) !important;
        line-height: 1.25 !important;
        border-bottom: 1px solid rgba(41, 89, 145, .14) !important;
      }

      #infoModal > .modal-content > h2::after {
        content: 'Inventário • RRN Agent • Chamados e manutenção';
        display: block;
        margin-top: 4px;
        color: #7b8795;
        font-size: .66rem;
        font-weight: 600;
        letter-spacing: .02em;
      }

      #infoModal #modalText {
        grid-column: 1 !important;
        grid-row: 2 / 6 !important;
        min-width: 0 !important;
        min-height: 0 !important;
        overflow-x: hidden !important;
        overflow-y: auto !important;
        padding-right: 5px !important;
        scrollbar-width: thin;
        scrollbar-color: rgba(41, 89, 145, .35) transparent;
      }

      #infoModal #modalText::-webkit-scrollbar,
      #infoModal #maintenanceSection::-webkit-scrollbar,
      #infoModal #observationsList::-webkit-scrollbar {
        width: 7px;
      }

      #infoModal #modalText::-webkit-scrollbar-thumb,
      #infoModal #maintenanceSection::-webkit-scrollbar-thumb,
      #infoModal #observationsList::-webkit-scrollbar-thumb {
        background: rgba(41, 89, 145, .28);
        border-radius: 10px;
      }

      #infoModal .rrn-machine-detail-card {
        display: grid !important;
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        gap: 10px !important;
        padding: 0 !important;
        border: 0 !important;
        background: transparent !important;
      }

      #infoModal .rrn-info-row {
        display: flex !important;
        flex-direction: column !important;
        gap: 4px !important;
        min-width: 0 !important;
        min-height: 70px !important;
        padding: 11px 12px !important;
        border: 1px solid rgba(41, 89, 145, .13) !important;
        border-radius: 11px !important;
        background: #fff !important;
        box-shadow: 0 3px 10px rgba(36, 56, 77, .045) !important;
      }

      #infoModal .rrn-info-row strong {
        color: #718096 !important;
        font-size: .62rem !important;
        line-height: 1.2 !important;
        text-transform: uppercase !important;
        letter-spacing: .035em !important;
      }

      #infoModal .rrn-info-row span {
        color: #24384d !important;
        font-size: .78rem !important;
        font-weight: 700 !important;
        line-height: 1.35 !important;
        overflow-wrap: anywhere !important;
      }

      #infoModal .rrn-inline-edit {
        grid-column: 1 / -1 !important;
        justify-self: start !important;
        margin: 0 !important;
        padding: 6px 10px !important;
        font-size: .7rem !important;
      }

      #infoModal .rrn-info-note {
        grid-column: 1 / -1 !important;
        margin: 0 !important;
        padding: 12px !important;
        border: 1px solid rgba(41, 89, 145, .13) !important;
        border-radius: 11px !important;
        background: #fff !important;
      }

      #infoModal .rrn-agent-location-card {
        grid-column: 1 / -1 !important;
        margin-top: 2px !important;
        padding: 14px !important;
        border: 1px solid rgba(41, 89, 145, .15) !important;
        border-radius: 14px !important;
        background: #fff !important;
        box-shadow: 0 4px 14px rgba(36, 56, 77, .055) !important;
      }

      #infoModal .rrn-agent-location-meta {
        grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
      }

      #infoModal .rrn-agent-mini-map {
        height: 285px !important;
      }

      #infoModal #maintenanceSection {
        grid-column: 2 !important;
        grid-row: 2 !important;
        min-width: 0 !important;
        min-height: 0 !important;
        max-height: 39vh !important;
        overflow-y: auto !important;
        padding: 14px !important;
        border: 1px solid rgba(41, 89, 145, .14) !important;
        border-radius: 14px !important;
        background: #fff !important;
        box-shadow: 0 4px 14px rgba(36, 56, 77, .055) !important;
      }

      #infoModal #maintenanceSection > h3,
      #infoModal #observationsList > h3 {
        margin: 0 0 10px !important;
        padding: 0 !important;
        max-width: none !important;
        text-align: left !important;
        color: #295991 !important;
        font-size: .86rem !important;
      }

      #infoModal #maintenanceSection textarea,
      #infoModal #maintenanceSection select {
        width: 100% !important;
        max-width: none !important;
        box-sizing: border-box !important;
        border: 1px solid rgba(41, 89, 145, .22) !important;
        border-radius: 9px !important;
        background: #f8fafc !important;
        color: #24384d !important;
        box-shadow: none !important;
      }

      #infoModal #maintenanceSection textarea {
        min-height: 84px !important;
        padding: 10px !important;
        resize: vertical !important;
      }

      #infoModal #maintenanceSection select {
        padding: 9px 10px !important;
      }

      #infoModal #maintenanceSection fieldset {
        margin-top: 10px !important;
        padding: 10px !important;
        border: 1px solid rgba(41, 89, 145, .14) !important;
        border-radius: 10px !important;
        background: #f8fafc !important;
      }

      #infoModal #maintenanceSection fieldset label {
        display: inline-block !important;
        margin: 3px 0 !important;
        color: #44546a !important;
        font-size: .72rem !important;
      }

      #infoModal #maintenanceSection button {
        padding: 8px 11px !important;
        font-size: .7rem !important;
      }

      #infoModal #observationsList {
        grid-column: 2 !important;
        grid-row: 3 !important;
        min-width: 0 !important;
        min-height: 0 !important;
        max-height: none !important;
        margin: 0 !important;
        padding: 14px 10px 12px 14px !important;
        overflow-y: auto !important;
        border: 1px solid rgba(41, 89, 145, .14) !important;
        border-radius: 14px !important;
        background: #fff !important;
        box-shadow: 0 4px 14px rgba(36, 56, 77, .055) !important;
      }

      #infoModal #observationsUl {
        max-height: none !important;
        overflow: visible !important;
        padding-right: 4px !important;
      }

      #infoModal #maintenanceMessage {
        grid-column: 2 !important;
        grid-row: 4 !important;
        margin: 0 !important;
        padding: 9px 11px !important;
        border: 1px solid rgba(242, 191, 79, .55) !important;
        border-radius: 10px !important;
        background: rgba(242, 191, 79, .13) !important;
        color: #6b5720 !important;
        font-size: .72rem !important;
      }

      #infoModal .modal-actions {
        grid-column: 2 !important;
        grid-row: 5 !important;
        display: flex !important;
        flex-wrap: wrap !important;
        justify-content: flex-end !important;
        gap: 8px !important;
        margin: 0 !important;
        padding-top: 2px !important;
      }

      #infoModal .modal-actions button {
        min-width: 108px !important;
        padding: 9px 13px !important;
        font-size: .72rem !important;
      }

      #infoModal .close-btn {
        position: absolute !important;
        top: 14px !important;
        right: 14px !important;
        width: 36px !important;
        height: 36px !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        margin: 0 !important;
        padding: 0 !important;
        border-radius: 10px !important;
        background: #fff !important;
        color: #295991 !important;
        border: 1px solid rgba(41, 89, 145, .16) !important;
        box-shadow: 0 3px 10px rgba(36, 56, 77, .08) !important;
        font-size: 1.35rem !important;
        line-height: 1 !important;
        z-index: 5 !important;
      }

      #infoModal .close-btn:hover {
        background: #295991 !important;
        color: #fff !important;
        transform: none !important;
      }

      @media (max-width: 1080px) {
        #infoModal > .modal-content {
          grid-template-columns: minmax(0, 1fr) minmax(320px, .8fr) !important;
          width: calc(100vw - 28px) !important;
          height: calc(100dvh - 28px) !important;
          max-height: calc(100dvh - 28px) !important;
          padding: 16px !important;
          column-gap: 12px !important;
        }

        #infoModal .rrn-agent-location-meta {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }

        #infoModal .rrn-agent-mini-map {
          height: 230px !important;
        }
      }

      @media (max-width: 820px) {
        #infoModal.modal {
          padding: 8px !important;
          align-items: flex-start !important;
        }

        #infoModal > .modal-content {
          display: block !important;
          width: calc(100vw - 16px) !important;
          height: auto !important;
          max-height: calc(100dvh - 16px) !important;
          padding: 16px !important;
          overflow-y: auto !important;
          border-radius: 15px !important;
        }

        #infoModal > .modal-content > h2 {
          margin-bottom: 12px !important;
        }

        #infoModal #modalText,
        #infoModal #maintenanceSection,
        #infoModal #observationsList,
        #infoModal #maintenanceMessage,
        #infoModal .modal-actions {
          display: block !important;
          width: 100% !important;
          max-height: none !important;
          overflow: visible !important;
          margin: 0 0 12px !important;
          padding-right: 0 !important;
        }

        #infoModal #maintenanceSection,
        #infoModal #observationsList {
          padding: 13px !important;
        }

        #infoModal .rrn-machine-detail-card {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }

        #infoModal .modal-actions {
          display: flex !important;
        }
      }

      @media (max-width: 540px) {
        #infoModal .rrn-machine-detail-card,
        #infoModal .rrn-agent-location-meta {
          grid-template-columns: 1fr !important;
        }

        #infoModal .rrn-agent-mini-map {
          height: 210px !important;
        }

        #infoModal .modal-actions button {
          flex: 1 1 100% !important;
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
