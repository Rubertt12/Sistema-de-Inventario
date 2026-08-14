(() => {
  'use strict';
  if (window.__RRN_SUPPORT_PORTAL_CLOSE_V2__) return;
  window.__RRN_SUPPORT_PORTAL_CLOSE_V2__ = true;

  const cfg = window.RRN_SUPABASE || {};
  if (!cfg.url || !cfg.anonKey || !window.supabase?.createClient) return;

  const client = window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });

  const style = document.createElement('style');
  style.id = 'rrnSupportPortalCloseStyles';
  style.textContent = `
    .rrn-requester-close-row{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}
    .rrn-requester-close-row[hidden]{display:none!important}
    .rrn-requester-close{border-color:color-mix(in srgb,var(--support-danger) 45%,var(--support-border))!important;color:var(--support-danger)!important;background:color-mix(in srgb,var(--support-danger) 5%,var(--support-surface))!important}
    .rrn-requester-close:hover{background:color-mix(in srgb,var(--support-danger) 10%,var(--support-surface))!important}
    .support-modal-card{width:min(760px,calc(100vw - 32px))!important;height:min(720px,calc(100vh - 36px))!important;max-height:calc(100vh - 36px)!important}
    .support-wizard-feed{flex:1!important;min-height:0!important;max-height:none!important;padding:20px!important;overflow-y:auto!important;overflow-x:hidden!important}
    .support-wizard-compose{flex:0 0 auto!important;padding:14px!important;background:var(--support-surface)!important}
    .support-wizard-bubble{max-width:min(88%,620px)!important;word-break:break-word!important}
    @media(max-width:620px){
      .support-modal{padding:8px!important;align-items:stretch!important}
      .support-modal-card{width:100%!important;height:calc(100dvh - 16px)!important;max-height:calc(100dvh - 16px)!important;border-radius:15px!important}
      .support-wizard-feed{padding:14px!important}
      .support-wizard-compose{grid-template-columns:1fr auto!important;padding:10px!important}
      .rrn-requester-close-row{justify-content:stretch}.rrn-requester-close{width:100%}
    }
  `;
  document.head.appendChild(style);

  function ticketNumberFromDom() {
    const text = document.getElementById('supportTicketNumber')?.textContent || '';
    const match = text.match(/#(\d+)/);
    return match ? Number(match[1]) : null;
  }

  async function getCurrentTicket() {
    const ticketNumber = ticketNumberFromDom();
    if (!ticketNumber) return null;
    const { data, error } = await client.from('support_tickets')
      .select('id,ticket_number,status,closed_at')
      .eq('ticket_number', ticketNumber)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  function ensureCloseButton() {
    const view = document.getElementById('supportTicketView');
    const asset = document.getElementById('supportTicketAsset');
    if (!view || !asset) return;
    let row = document.getElementById('rrnRequesterCloseRow');
    if (!row) {
      row = document.createElement('div');
      row.id = 'rrnRequesterCloseRow';
      row.className = 'rrn-requester-close-row';
      row.innerHTML = '<button type="button" class="support-btn rrn-requester-close" id="rrnRequesterCloseBtn">Encerrar chamado</button>';
      asset.insertAdjacentElement('afterend', row);
      document.getElementById('rrnRequesterCloseBtn')?.addEventListener('click', closeTicket);
    }
    const status = document.getElementById('supportTicketStatus')?.textContent?.trim().toLowerCase() || '';
    row.hidden = !ticketNumberFromDom() || status === 'encerrado';
  }

  async function closeTicket() {
    const button = document.getElementById('rrnRequesterCloseBtn');
    if (!button) return;
    if (!confirm('Encerrar este chamado? Depois disso a conversa ficará somente para consulta.')) return;
    button.disabled = true;
    const original = button.textContent;
    button.textContent = 'Encerrando...';
    try {
      const ticket = await getCurrentTicket();
      if (!ticket?.id) throw new Error('Não foi possível localizar o chamado.');
      const { data, error } = await client.rpc('support_requester_close_ticket', { p_ticket_id: ticket.id });
      if (error) throw error;
      const status = document.getElementById('supportTicketStatus');
      if (status) { status.textContent = 'Encerrado'; status.className = 'support-status closed'; }
      const input = document.getElementById('supportMessageInput');
      const send = document.querySelector('#supportMessageForm button');
      if (input) { input.disabled = true; input.placeholder = 'Chamado encerrado.'; }
      if (send) send.disabled = true;
      document.getElementById('rrnRequesterCloseRow').hidden = true;
      document.getElementById('supportRefreshBtn')?.click();
      const toast = document.getElementById('supportToast');
      if (toast) {
        toast.textContent = `Chamado #${data?.ticket_number || ticket.ticket_number} encerrado.`;
        toast.className = 'support-toast success';
        toast.hidden = false;
        setTimeout(() => { toast.hidden = true; }, 3200);
      }
    } catch (error) {
      alert(error?.message || 'Não foi possível encerrar o chamado.');
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }

  const refresh = () => requestAnimationFrame(ensureCloseButton);
  new MutationObserver(refresh).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['hidden','class'] });
  document.addEventListener('click', event => {
    if (event.target.closest('[data-ticket-id]')) setTimeout(ensureCloseButton, 80);
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refresh, { once: true });
  else refresh();
})();
