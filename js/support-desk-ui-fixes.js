(() => {
  'use strict';
  const button = document.getElementById('deskRefreshBtn');
  if (!button || button.dataset.rrnRefreshEnhanced === '1') return;
  button.dataset.rrnRefreshEnhanced = '1';
  button.addEventListener('click', () => {
    const original = button.textContent;
    button.disabled = true;
    button.textContent = '↻ Atualizando...';
    setTimeout(() => {
      button.disabled = false;
      button.textContent = original || '↻ Atualizar';
      const selected = document.querySelector('#deskTicketList [data-ticket-id].active');
      if (selected) selected.click();
    }, 900);
  });
})();