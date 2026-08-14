(() => {
  'use strict';
  if (window.__RRN_HIDE_FINALIZED_FROM_ALL__) return;
  window.__RRN_HIDE_FINALIZED_FROM_ALL__ = true;

  let applying = false;

  function isClosedCard(card) {
    const badge = card.querySelector('.desk-badge');
    return badge?.classList.contains('closed') || /encerrado/i.test(badge?.textContent || '');
  }

  function sync() {
    if (applying) return;
    const all = document.querySelector('[data-desk-filter="all"]');
    const finalized = document.querySelector('[data-desk-filter="closed"]');
    const allActive = all?.classList.contains('active');
    const finalizedActive = finalized?.classList.contains('active');
    const cards = [...document.querySelectorAll('#deskTicketList [data-ticket-id]')];

    applying = true;
    try {
      if (allActive && !finalizedActive) {
        let visible = 0;
        cards.forEach(card => {
          const hide = isClosedCard(card);
          card.classList.toggle('rrn-finalized-hidden', hide);
          if (!hide) visible += 1;
        });
        const count = document.getElementById('deskListCount');
        if (count) count.textContent = `${visible} ${visible === 1 ? 'chamado ativo' : 'chamados ativos'}`;
        const title = document.getElementById('deskListTitle');
        if (title) title.textContent = 'Fila de atendimento';
      } else if (!finalizedActive) {
        cards.forEach(card => card.classList.remove('rrn-finalized-hidden'));
      }
    } finally {
      applying = false;
    }
  }

  document.addEventListener('click', event => {
    if (event.target.closest('[data-desk-filter]')) {
      setTimeout(sync, 0);
      setTimeout(sync, 80);
    }
  });

  const observer = new MutationObserver(() => requestAnimationFrame(sync));
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class']
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync, { once: true });
  else sync();
})();
