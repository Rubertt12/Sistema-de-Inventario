(() => {
  'use strict';
  if (window.__RRN_SUPPORT_DESK_CLOSE_V2__) return;
  window.__RRN_SUPPORT_DESK_CLOSE_V2__ = true;

  const cfg = window.RRN_SUPABASE || {};
  if (!cfg.url || !cfg.anonKey || !window.supabase?.createClient) return;
  const client = window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });

  const style = document.createElement('style');
  style.textContent = `
    .rrn-desk-close-wrap{display:flex;justify-content:flex-end;margin-top:10px}
    .rrn-desk-close-wrap[hidden]{display:none!important}
    .rrn-desk-close-btn{border-color:color-mix(in srgb,var(--desk-danger,#b64949) 48%,var(--desk-border))!important;color:var(--desk-danger,#b64949)!important;background:transparent!important}
    .rrn-desk-close-btn:hover{background:color-mix(in srgb,var(--desk-danger,#b64949) 8%,var(--desk-surface))!important}
  `;
  document.head.appendChild(style);

  function selectedTicketId() {
    return document.querySelector('[data-ticket-id].active')?.dataset.ticketId || null;
  }

  function syncButton() {
    const view = document.getElementById('deskTicketView');
    const row = document.getElementById('deskActionRow');
    if (!view || !row) return;
    let wrap = document.getElementById('rrnDeskCloseWrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'rrnDeskCloseWrap';
      wrap.className = 'rrn-desk-close-wrap';
      wrap.innerHTML = '<button type="button" class="desk-btn rrn-desk-close-btn" id="rrnDeskCloseBtn">Encerrar atendimento</button>';
      row.insertAdjacentElement('afterend', wrap);
      document.getElementById('rrnDeskCloseBtn')?.addEventListener('click', closeTicket);
    }
    const status = document.getElementById('deskTicketStatus')?.textContent?.trim().toLowerCase() || '';
    wrap.hidden = view.hidden || !selectedTicketId() || status === 'encerrado';
  }

  async function closeTicket() {
    const id = selectedTicketId();
    const button = document.getElementById('rrnDeskCloseBtn');
    if (!id || !button) return;
    if (!confirm('Encerrar este atendimento agora? O cliente verá o chamado como encerrado imediatamente, sem precisar confirmar.')) return;
    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'Encerrando...';
    try {
      const { data, error } = await client.rpc('support_staff_close_ticket', { p_ticket_id: id });
      if (error) throw error;
      const status = document.getElementById('deskTicketStatus');
      if (status) { status.textContent = 'Encerrado'; status.className = 'desk-badge closed'; }
      const input = document.getElementById('deskMessageInput');
      const send = document.querySelector('#deskMessageForm button');
      if (input) { input.disabled = true; input.placeholder = 'Chamado encerrado.'; }
      if (send) send.disabled = true;
      const wrap = document.getElementById('rrnDeskCloseWrap');
      if (wrap) wrap.hidden = true;
      document.getElementById('deskRefreshBtn')?.click();
      const toast = document.getElementById('deskToast');
      if (toast) {
        toast.textContent = `Chamado #${data?.ticket_number || ''} encerrado. O cliente não precisa confirmar.`;
        toast.className = 'desk-toast success';
        toast.hidden = false;
        setTimeout(() => { toast.hidden = true; }, 3400);
      }
    } catch (error) {
      alert(error?.message || 'Não foi possível encerrar o atendimento.');
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }

  const observer = new MutationObserver(() => requestAnimationFrame(syncButton));
  observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['hidden','class'] });
  document.addEventListener('click', event => {
    if (event.target.closest('[data-ticket-id]')) setTimeout(syncButton, 70);
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncButton, { once: true });
  else syncButton();
})();
