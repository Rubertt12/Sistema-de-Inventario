(() => {
  'use strict';
  if (window.__RRN_SUPPORT_DESK_EMPTY_STATE__) return;
  window.__RRN_SUPPORT_DESK_EMPTY_STATE__ = true;

  let syncing = false;

  function currentFilter() {
    return document.querySelector('[data-desk-filter].active')?.dataset.deskFilter || 'all';
  }

  function visibleCards() {
    return [...document.querySelectorAll('#deskTicketList [data-ticket-id]')].filter(card => {
      const style = getComputedStyle(card);
      return style.display !== 'none' && !card.hidden;
    });
  }

  function setEmpty(title, text) {
    const empty = document.getElementById('deskEmpty');
    const view = document.getElementById('deskTicketView');
    if (!empty || !view) return;
    view.hidden = true;
    empty.hidden = false;
    const h2 = empty.querySelector('h2');
    const p = empty.querySelector('p');
    if (h2) h2.textContent = title;
    if (p) p.textContent = text;
  }

  function sync() {
    if (syncing) return;
    syncing = true;
    requestAnimationFrame(() => {
      try {
        const list = document.getElementById('deskTicketList');
        const empty = document.getElementById('deskEmpty');
        if (!list || !empty) return;
        const cards = visibleCards();
        const filter = currentFilter();
        const activeSelected = cards.some(card => card.classList.contains('active'));

        if (!cards.length) {
          if (filter === 'closed') {
            setEmpty('Nenhum chamado finalizado', 'Os atendimentos encerrados aparecerão aqui.');
          } else {
            setEmpty('Aguardando chamado...', 'A fila está livre. Um novo atendimento aparecerá aqui automaticamente.');
          }
          return;
        }

        if (!activeSelected && document.getElementById('deskTicketView')?.hidden) {
          const h2 = empty.querySelector('h2');
          const p = empty.querySelector('p');
          if (h2) h2.textContent = 'Selecione um chamado';
          if (p) p.textContent = 'Abra um item da fila para ver solicitante, equipamento, setor, SLA e a conversa completa.';
        }
      } finally {
        syncing = false;
      }
    });
  }

  const observer = new MutationObserver(sync);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class','hidden','style']
  });

  document.addEventListener('click', event => {
    if (event.target.closest('[data-desk-filter], [data-ticket-id], #deskCloseBtn, #deskRefreshBtn')) {
      setTimeout(sync, 80);
      setTimeout(sync, 220);
    }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync, { once: true });
  else sync();
})();