(() => {
  'use strict';
  if (window.__RRN_SUPPORT_QUEUE_TOGGLE__) return;
  window.__RRN_SUPPORT_QUEUE_TOGGLE__ = true;

  const STORAGE_KEY = 'rrn_support_queue_collapsed';
  const body = document.body;
  const listPanel = document.querySelector('.desk-list-panel');
  const toolbar = document.querySelector('.desk-toolbar');
  if (!listPanel || !toolbar) return;

  const style = document.createElement('style');
  style.textContent = `
    .desk-queue-toggle{margin-left:auto!important;display:inline-flex!important;align-items:center!important;gap:7px!important}
    .desk-body.rrn-queue-collapsed .desk-grid{grid-template-columns:0 minmax(0,1fr)!important}
    .desk-body.rrn-queue-collapsed .desk-list-panel{width:0!important;min-width:0!important;max-width:0!important;overflow:hidden!important;border-right:0!important;opacity:0!important;pointer-events:none!important}
    .desk-body.rrn-queue-collapsed .desk-detail-panel{grid-column:2!important;width:100%!important}
    .desk-body.rrn-queue-collapsed .desk-ticket-view{grid-template-columns:minmax(340px,420px) minmax(0,1fr)!important}
    @media(min-width:1500px){.desk-body.rrn-queue-collapsed .desk-ticket-view{grid-template-columns:minmax(390px,480px) minmax(0,1fr)!important}}
    @media(max-width:980px){
      .desk-queue-toggle{margin-left:0!important}
      .desk-body.rrn-queue-collapsed .desk-grid{display:block!important}
      .desk-body.rrn-queue-collapsed .desk-list-panel{display:none!important}
      .desk-body.rrn-queue-collapsed .desk-detail-panel{width:100%!important}
      .desk-body.rrn-queue-collapsed .desk-ticket-view{grid-template-columns:minmax(300px,360px) minmax(0,1fr)!important}
    }
    @media(max-width:680px){
      .desk-body.rrn-queue-collapsed .desk-ticket-view{display:flex!important;flex-direction:column!important}
    }
  `;
  document.head.appendChild(style);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'desk-btn desk-queue-toggle';
  button.id = 'deskQueueToggleBtn';
  toolbar.appendChild(button);

  function isCollapsed() {
    return body.classList.contains('rrn-queue-collapsed');
  }

  function syncButton() {
    const collapsed = isCollapsed();
    button.textContent = collapsed ? '☰ Mostrar fila' : '← Ocultar fila';
    button.setAttribute('aria-expanded', String(!collapsed));
    button.title = collapsed ? 'Mostrar fila de atendimento' : 'Ocultar fila de atendimento';
  }

  function setCollapsed(value) {
    body.classList.toggle('rrn-queue-collapsed', value);
    localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
    syncButton();
  }

  button.addEventListener('click', () => setCollapsed(!isCollapsed()));
  setCollapsed(localStorage.getItem(STORAGE_KEY) === '1');
})();
