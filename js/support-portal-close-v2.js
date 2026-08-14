(() => {
  'use strict';
  if (window.__RRN_SUPPORT_PORTAL_CLOSE_V2__) return;
  window.__RRN_SUPPORT_PORTAL_CLOSE_V2__ = true;

  const cfg = window.RRN_SUPABASE || {};
  if (!cfg.url || !cfg.anonKey || !window.supabase?.createClient) return;

  const client = window.RRN_SUPABASE_CLIENT || window.RRN_GET_SUPABASE_CLIENT?.() || window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });
  const fromChat = new URLSearchParams(location.search).get('from') === 'chat';

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

    body.rrn-chat-portal-app{height:100dvh!important;min-height:0!important;overflow:hidden!important;background:var(--support-bg,#f4f7f8)!important}
    body.rrn-chat-portal-app .support-topbar{display:none!important}
    body.rrn-chat-portal-app .support-shell,
    body.rrn-chat-portal-app .support-main,
    body.rrn-chat-portal-app #supportApp:not([hidden]){height:100dvh!important;min-height:0!important;max-height:100dvh!important}
    body.rrn-chat-portal-app .support-shell{display:block!important;overflow:hidden!important}
    body.rrn-chat-portal-app .support-main{display:block!important;padding:0!important;overflow:hidden!important}
    body.rrn-chat-portal-app #supportApp:not([hidden]){display:block!important;overflow:hidden!important}
    body.rrn-chat-portal-app .support-app-grid{display:grid!important;grid-template-columns:minmax(0,1fr)!important;grid-template-rows:auto minmax(0,1fr)!important;height:100%!important;min-height:0!important;overflow:hidden!important}
    body.rrn-chat-portal-app .support-sidebar{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;grid-template-rows:auto auto!important;gap:7px 8px!important;min-height:0!important;max-height:168px!important;padding:9px 10px!important;border-right:0!important;border-bottom:1px solid var(--support-border,rgba(22,58,77,.12))!important;overflow:hidden!important;background:var(--support-surface,#fff)!important}
    body.rrn-chat-portal-app .support-user-card{grid-column:1;grid-row:1;margin:0!important;padding:6px 8px!important;min-height:0!important}
    body.rrn-chat-portal-app .support-user-card small{font-size:.58rem!important}
    body.rrn-chat-portal-app .support-user-card strong{font-size:.76rem!important}
    body.rrn-chat-portal-app .support-user-card span{font-size:.59rem!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    body.rrn-chat-portal-app .support-sidebar-actions{grid-column:2;grid-row:1;align-self:center;margin:0!important;display:flex!important;gap:5px!important}
    body.rrn-chat-portal-app .support-sidebar-actions .support-btn{min-height:34px!important;padding:0 9px!important;font-size:.65rem!important}
    body.rrn-chat-portal-app .support-ticket-list{grid-column:1/-1;grid-row:2;display:flex!important;gap:7px!important;min-height:0!important;overflow-x:auto!important;overflow-y:hidden!important;padding:0 0 3px!important;scrollbar-width:thin!important}
    body.rrn-chat-portal-app .support-ticket-item{flex:0 0 215px!important;min-width:215px!important;max-width:245px!important;padding:8px 9px!important;margin:0!important}
    body.rrn-chat-portal-app .support-ticket-item h3,
    body.rrn-chat-portal-app .support-ticket-item strong{font-size:.68rem!important}
    body.rrn-chat-portal-app .support-ticket-item small,
    body.rrn-chat-portal-app .support-ticket-item span{font-size:.56rem!important}
    body.rrn-chat-portal-app .support-content{height:100%!important;min-height:0!important;overflow:hidden!important;background:var(--support-bg,#f4f7f8)!important}
    body.rrn-chat-portal-app .support-empty{height:100%!important;min-height:0!important;padding:18px!important;overflow:hidden!important}
    body.rrn-chat-portal-app .support-ticket-view:not([hidden]){display:flex!important;flex-direction:column!important;height:100%!important;min-height:0!important;overflow:hidden!important}
    body.rrn-chat-portal-app .support-ticket-head{flex:0 0 auto!important;padding:10px 12px!important}
    body.rrn-chat-portal-app .support-ticket-head h2{font-size:.92rem!important;margin:2px 0!important}
    body.rrn-chat-portal-app .support-ticket-head small,
    body.rrn-chat-portal-app .support-ticket-head span{font-size:.58rem!important}
    body.rrn-chat-portal-app .support-asset-card{margin-top:6px!important;padding:7px 9px!important}
    body.rrn-chat-portal-app .support-resolution-box{flex:0 0 auto!important;margin:0 10px 7px!important;padding:8px!important}
    body.rrn-chat-portal-app .rrn-requester-close-row{flex:0 0 auto!important;margin:0 10px 7px!important}
    body.rrn-chat-portal-app .support-chat{display:flex!important;flex:1 1 auto!important;flex-direction:column!important;min-height:0!important;overflow:hidden!important}
    body.rrn-chat-portal-app .support-chat-messages{flex:1 1 auto!important;min-height:0!important;overflow-y:auto!important;overscroll-behavior:contain!important;padding:10px!important}
    body.rrn-chat-portal-app .support-chat-compose{flex:0 0 auto!important;padding:8px!important;background:var(--support-surface,#fff)!important;border-top:1px solid var(--support-border,rgba(22,58,77,.12))!important}
    body.rrn-chat-portal-app .support-chat-compose input{min-height:38px!important}
    body.rrn-chat-portal-app .rrn-footer{display:none!important}

    @media(max-width:620px){
      .support-modal{padding:8px!important;align-items:stretch!important}
      .support-modal-card{width:100%!important;height:calc(100dvh - 16px)!important;max-height:calc(100dvh - 16px)!important;border-radius:15px!important}
      .support-wizard-feed{padding:14px!important}
      .support-wizard-compose{grid-template-columns:1fr auto!important;padding:10px!important}
      .rrn-requester-close-row{justify-content:stretch}.rrn-requester-close{width:100%}
      body.rrn-chat-portal-app .support-sidebar{max-height:156px!important;padding:7px!important}
      body.rrn-chat-portal-app .support-ticket-item{flex-basis:190px!important;min-width:190px!important}
    }
  `;
  document.head.appendChild(style);

  function resetScroll() {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    try { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); } catch (_) { window.scrollTo(0, 0); }
    document.querySelector('.support-main')?.scrollTo?.(0, 0);
  }

  function syncChatPortalMode() {
    if (!fromChat) return;
    const auth = document.getElementById('supportAuthView');
    const app = document.getElementById('supportApp');
    const authenticated = Boolean(app && !app.hidden);
    document.body.classList.toggle('chat-login-only', !authenticated);
    document.body.classList.toggle('rrn-chat-portal-app', authenticated);
    if (authenticated) {
      resetScroll();
      requestAnimationFrame(resetScroll);
    }
  }

  function installChatModeWatcher() {
    if (!fromChat) return;
    const auth = document.getElementById('supportAuthView');
    const app = document.getElementById('supportApp');
    const observer = new MutationObserver(syncChatPortalMode);
    if (auth) observer.observe(auth, { attributes: true, attributeFilter: ['hidden'] });
    if (app) observer.observe(app, { attributes: true, attributeFilter: ['hidden'] });
    syncChatPortalMode();
    window.addEventListener('pageshow', syncChatPortalMode);
  }

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
      const row = document.getElementById('rrnRequesterCloseRow');
      if (row) row.hidden = true;
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

  function installCloseButtonWatcher() {
    const refresh = () => requestAnimationFrame(ensureCloseButton);
    const status = document.getElementById('supportTicketStatus');
    const number = document.getElementById('supportTicketNumber');
    const view = document.getElementById('supportTicketView');
    const observer = new MutationObserver(refresh);
    if (status) observer.observe(status, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    if (number) observer.observe(number, { childList: true, characterData: true, subtree: true });
    if (view) observer.observe(view, { attributes: true, attributeFilter: ['hidden'] });
    document.addEventListener('click', event => {
      if (event.target.closest('[data-ticket-id],#supportRefreshBtn')) setTimeout(refresh, 80);
    });
    refresh();
  }

  const boot = () => {
    installChatModeWatcher();
    installCloseButtonWatcher();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();

(() => {
  if (document.querySelector('script[data-rrn-typing-indicator]')) return;
  const script = document.createElement('script');
  script.src = '/js/support-typing-indicator.js?v=20260814-2';
  script.async = false;
  script.dataset.rrnTypingIndicator = '1';
  document.head.appendChild(script);
})();