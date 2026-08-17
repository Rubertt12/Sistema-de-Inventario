// RRN Manager — compatibilidade histórica e hotfixes globais de interface.
(() => {
  'use strict';
  window.RRN_LEGACY_MAIN_RETIRED = true;

  function installInfoModalLayout() {
    const modal = document.getElementById('infoModal');
    const content = modal?.querySelector(':scope > .modal-content');
    const title = content?.querySelector(':scope > h2');
    const modalText = document.getElementById('modalText');
    const maintenance = document.getElementById('maintenanceSection');
    const observations = document.getElementById('observationsList');
    const message = document.getElementById('maintenanceMessage');
    const actions = content?.querySelector(':scope > .modal-actions');
    if (!modal || !content || !title || !modalText || !maintenance || !observations || !actions) return;

    if (!document.getElementById('rrn-info-modal-layout-v3')) {
      const style = document.createElement('style');
      style.id = 'rrn-info-modal-layout-v3';
      style.textContent = `
        html.rrn-info-modal-open,
        body.rrn-info-modal-open {
          overflow: hidden !important;
          overscroll-behavior: none !important;
        }

        #infoModal.modal {
          position: fixed !important;
          inset: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          height: 100dvh !important;
          margin: 0 !important;
          padding: 12px !important;
          display: none;
          align-items: flex-start !important;
          justify-content: center !important;
          overflow: hidden !important;
          box-sizing: border-box !important;
          background: rgba(12, 22, 30, .76) !important;
          backdrop-filter: blur(6px) !important;
          -webkit-backdrop-filter: blur(6px) !important;
          z-index: 1600 !important;
        }

        #infoModal > .modal-content {
          position: relative !important;
          display: flex !important;
          flex-direction: column !important;
          width: min(1380px, calc(100vw - 24px)) !important;
          max-width: 1380px !important;
          height: calc(100vh - 24px) !important;
          height: calc(100dvh - 24px) !important;
          max-height: 900px !important;
          margin: 0 !important;
          padding: 16px !important;
          box-sizing: border-box !important;
          overflow: hidden !important;
          border: 1px solid rgba(41, 89, 145, .16) !important;
          border-radius: 18px !important;
          background: #f6f8fb !important;
          box-shadow: 0 26px 80px rgba(0, 0, 0, .35) !important;
        }

        #infoModal > .modal-content > h2 {
          flex: 0 0 auto !important;
          margin: 0 0 12px !important;
          padding: 2px 52px 12px 2px !important;
          border-bottom: 1px solid rgba(41, 89, 145, .13) !important;
          color: #24384d !important;
          font-size: 1.2rem !important;
          line-height: 1.2 !important;
        }

        #infoModal > .modal-content > h2::after {
          content: 'Inventário • RRN Agent • Chamados e manutenção';
          display: block;
          margin-top: 4px;
          color: #7b8795;
          font-size: .64rem;
          font-weight: 600;
        }

        #infoModal .rrn-info-shell {
          flex: 1 1 auto !important;
          min-height: 0 !important;
          display: grid !important;
          grid-template-columns: minmax(0, 1.5fr) minmax(360px, .9fr) !important;
          gap: 14px !important;
          overflow: hidden !important;
        }

        #infoModal .rrn-info-main,
        #infoModal .rrn-info-side {
          min-width: 0 !important;
          min-height: 0 !important;
        }

        #infoModal .rrn-info-main {
          overflow: hidden !important;
        }

        #infoModal #modalText {
          width: 100% !important;
          height: 100% !important;
          min-height: 0 !important;
          overflow-x: hidden !important;
          overflow-y: auto !important;
          padding: 2px 7px 8px 2px !important;
          box-sizing: border-box !important;
          scrollbar-width: thin;
          scrollbar-color: rgba(41,89,145,.3) transparent;
        }

        #infoModal .rrn-info-side {
          display: grid !important;
          grid-template-rows: minmax(250px, 1.05fr) minmax(170px, .72fr) auto auto !important;
          gap: 10px !important;
          overflow: hidden !important;
        }

        #infoModal #maintenanceSection,
        #infoModal #observationsList {
          min-height: 0 !important;
          margin: 0 !important;
          padding: 13px !important;
          overflow-x: hidden !important;
          overflow-y: auto !important;
          border: 1px solid rgba(41, 89, 145, .14) !important;
          border-radius: 13px !important;
          background: #fff !important;
          box-shadow: 0 4px 14px rgba(36, 56, 77, .05) !important;
          box-sizing: border-box !important;
          scrollbar-width: thin;
          scrollbar-color: rgba(41,89,145,.3) transparent;
        }

        #infoModal #maintenanceSection > h3,
        #infoModal #observationsList > h3 {
          margin: 0 0 10px !important;
          padding: 0 !important;
          max-width: none !important;
          text-align: left !important;
          color: #295991 !important;
          font-size: .85rem !important;
        }

        #infoModal #maintenanceSection textarea,
        #infoModal #maintenanceSection select {
          width: 100% !important;
          max-width: none !important;
          box-sizing: border-box !important;
          border: 1px solid rgba(41, 89, 145, .2) !important;
          border-radius: 9px !important;
          background: #f8fafc !important;
          color: #24384d !important;
          box-shadow: none !important;
        }

        #infoModal #maintenanceSection textarea {
          min-height: 78px !important;
          padding: 9px !important;
          resize: vertical !important;
        }

        #infoModal #maintenanceSection fieldset {
          margin-top: 9px !important;
          padding: 9px !important;
          border: 1px solid rgba(41,89,145,.13) !important;
          border-radius: 10px !important;
          background: #f8fafc !important;
        }

        #infoModal #maintenanceSection fieldset label {
          display: inline-block !important;
          margin: 3px 0 !important;
          color: #44546a !important;
          font-size: .7rem !important;
        }

        #infoModal #maintenanceSection button,
        #infoModal .modal-actions button {
          padding: 8px 11px !important;
          font-size: .7rem !important;
        }

        #infoModal #observationsUl {
          max-height: none !important;
          overflow: visible !important;
          padding-right: 2px !important;
        }

        #infoModal #maintenanceMessage {
          margin: 0 !important;
          padding: 8px 10px !important;
          border: 1px solid rgba(242, 191, 79, .5) !important;
          border-radius: 9px !important;
          background: rgba(242,191,79,.12) !important;
          color: #6b5720 !important;
          font-size: .7rem !important;
        }

        #infoModal .modal-actions {
          display: flex !important;
          flex-wrap: wrap !important;
          justify-content: flex-end !important;
          gap: 8px !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        #infoModal .close-btn {
          position: absolute !important;
          top: 12px !important;
          right: 12px !important;
          width: 36px !important;
          height: 36px !important;
          margin: 0 !important;
          padding: 0 !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          border: 1px solid rgba(41,89,145,.15) !important;
          border-radius: 10px !important;
          background: #fff !important;
          color: #295991 !important;
          box-shadow: 0 3px 10px rgba(36,56,77,.08) !important;
          font-size: 1.3rem !important;
          line-height: 1 !important;
          z-index: 20 !important;
        }

        #infoModal .rrn-machine-detail-card {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 9px !important;
          padding: 0 !important;
          border: 0 !important;
          background: transparent !important;
        }

        #infoModal .rrn-machine-detail-card > :not(.rrn-info-row):not(.rrn-inline-edit) {
          grid-column: 1 / -1 !important;
          width: 100% !important;
          max-width: none !important;
          box-sizing: border-box !important;
        }

        #infoModal .rrn-info-row {
          display: flex !important;
          flex-direction: column !important;
          gap: 4px !important;
          min-width: 0 !important;
          min-height: 62px !important;
          padding: 10px 11px !important;
          border: 1px solid rgba(41,89,145,.12) !important;
          border-radius: 10px !important;
          background: #fff !important;
          box-shadow: 0 3px 10px rgba(36,56,77,.04) !important;
          box-sizing: border-box !important;
        }

        #infoModal .rrn-info-row strong {
          color: #718096 !important;
          font-size: .6rem !important;
          line-height: 1.2 !important;
          text-transform: uppercase !important;
          letter-spacing: .035em !important;
        }

        #infoModal .rrn-info-row span {
          color: #24384d !important;
          font-size: .76rem !important;
          font-weight: 700 !important;
          line-height: 1.35 !important;
          overflow-wrap: anywhere !important;
        }

        #infoModal .rrn-inline-edit {
          grid-column: 1 / -1 !important;
          justify-self: start !important;
          margin: 0 !important;
          padding: 6px 9px !important;
          font-size: .68rem !important;
        }

        #infoModal .rrn-agent-location-card {
          margin-top: 2px !important;
          padding: 13px !important;
          border-radius: 13px !important;
          background: #fff !important;
        }

        #infoModal .rrn-agent-location-meta {
          grid-template-columns: repeat(4, minmax(0,1fr)) !important;
        }

        #infoModal .rrn-agent-mini-map {
          height: 230px !important;
        }

        #infoModal #modalText::-webkit-scrollbar,
        #infoModal #maintenanceSection::-webkit-scrollbar,
        #infoModal #observationsList::-webkit-scrollbar {
          width: 7px;
        }

        #infoModal #modalText::-webkit-scrollbar-thumb,
        #infoModal #maintenanceSection::-webkit-scrollbar-thumb,
        #infoModal #observationsList::-webkit-scrollbar-thumb {
          background: rgba(41,89,145,.26);
          border-radius: 10px;
        }

        @media (max-width: 1050px) {
          #infoModal .rrn-info-shell {
            grid-template-columns: minmax(0, 1.35fr) minmax(330px, .9fr) !important;
          }
          #infoModal .rrn-agent-location-meta {
            grid-template-columns: repeat(2, minmax(0,1fr)) !important;
          }
        }

        @media (max-width: 820px) {
          #infoModal.modal {
            overflow: auto !important;
            padding: 8px !important;
          }
          #infoModal > .modal-content {
            width: calc(100vw - 16px) !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
          }
          #infoModal .rrn-info-shell {
            display: block !important;
            overflow: visible !important;
          }
          #infoModal .rrn-info-main,
          #infoModal .rrn-info-side,
          #infoModal #modalText,
          #infoModal #maintenanceSection,
          #infoModal #observationsList {
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
          }
          #infoModal .rrn-info-side {
            display: block !important;
          }
          #infoModal #maintenanceSection,
          #infoModal #observationsList,
          #infoModal #maintenanceMessage,
          #infoModal .modal-actions {
            margin-top: 10px !important;
          }
        }

        @media (max-width: 540px) {
          #infoModal .rrn-machine-detail-card,
          #infoModal .rrn-agent-location-meta {
            grid-template-columns: 1fr !important;
          }
          #infoModal .rrn-agent-mini-map {
            height: 205px !important;
          }
        }
      `;
      document.head.appendChild(style);
    }

    if (!content.querySelector('.rrn-info-shell')) {
      const shell = document.createElement('div');
      shell.className = 'rrn-info-shell';
      const main = document.createElement('section');
      main.className = 'rrn-info-main';
      const side = document.createElement('aside');
      side.className = 'rrn-info-side';

      title.insertAdjacentElement('afterend', shell);
      shell.append(main, side);
      main.appendChild(modalText);
      side.appendChild(maintenance);
      side.appendChild(observations);
      if (message) side.appendChild(message);
      side.appendChild(actions);
    }

    const resetScroll = () => {
      modal.scrollTop = 0;
      content.scrollTop = 0;
      modalText.scrollTop = 0;
      maintenance.scrollTop = 0;
      observations.scrollTop = 0;
    };

    const syncState = () => {
      const isOpen = modal.getAttribute('aria-hidden') !== 'true'
        && modal.style.display !== 'none'
        && getComputedStyle(modal).display !== 'none';
      document.documentElement.classList.toggle('rrn-info-modal-open', isOpen);
      document.body.classList.toggle('rrn-info-modal-open', isOpen);
      if (isOpen) requestAnimationFrame(() => requestAnimationFrame(resetScroll));
    };

    const observer = new MutationObserver(syncState);
    observer.observe(modal, { attributes: true, attributeFilter: ['style', 'class', 'aria-hidden'] });
    syncState();
    window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installInfoModalLayout, { once: true });
  } else {
    installInfoModalLayout();
  }
})();
