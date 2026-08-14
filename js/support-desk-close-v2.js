(() => {
  'use strict';
  if (window.__RRN_SUPPORT_DESK_CLOSE_V2__) return;
  window.__RRN_SUPPORT_DESK_CLOSE_V2__ = true;

  const cfg = window.RRN_SUPABASE || {};
  if (!cfg.url || !cfg.anonKey || !window.supabase?.createClient) return;
  const client = window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });

  let finalizedFilterActive = false;
  let filtering = false;

  const style = document.createElement('style');
  style.textContent = `
    #deskCloseBtn{border-color:color-mix(in srgb,var(--desk-danger,#b64949) 52%,var(--desk-border))!important;color:var(--desk-danger,#b64949)!important;background:transparent!important}
    #deskCloseBtn:hover{background:color-mix(in srgb,var(--desk-danger,#b64949) 9%,var(--desk-surface))!important}
    #deskCloseBtn[hidden]{display:none!important}
    .rrn-finalized-hidden{display:none!important}
  `;
  document.head.appendChild(style);

  function selectedTicketId() {
    return document.querySelector('[data-ticket-id].active')?.dataset.ticketId || null;
  }

  function currentStatus() {
    return (document.getElementById('deskTicketStatus')?.textContent || '').trim().toLowerCase();
  }

  function syncCloseButton() {
    const button = document.getElementById('deskCloseBtn');
    const view = document.getElementById('deskTicketView');
    if (!button || !view) return;
    const closed = currentStatus() === 'encerrado';
    button.hidden = view.hidden || !selectedTicketId() || closed;
    button.disabled = closed;
  }

  async function closeTicket() {
    const id = selectedTicketId();
    const button = document.getElementById('deskCloseBtn');
    if (!id || !button) return;

    const ok = confirm('Encerrar este atendimento agora? O chamado será finalizado imediatamente para você e para o cliente.');
    if (!ok) return;

    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'Encerrando...';

    try {
      const { data, error } = await client.rpc('support_staff_close_ticket', { p_ticket_id: id });
      if (error) throw error;

      const status = document.getElementById('deskTicketStatus');
      if (status) {
        status.textContent = 'Encerrado';
        status.className = 'desk-badge closed';
      }

      ['deskClaimBtn','deskWaitingBtn','deskResolveBtn','deskCloseBtn'].forEach(key => {
        const el = document.getElementById(key);
        if (el) el.hidden = true;
      });

      const input = document.getElementById('deskMessageInput');
      const send = document.querySelector('#deskMessageForm button[type="submit"]');
      if (input) {
        input.disabled = true;
        input.placeholder = 'Atendimento encerrado.';
      }
      if (send) send.disabled = true;

      const toast = document.getElementById('deskToast');
      if (toast) {
        toast.textContent = `Chamado #${data?.ticket_number || ''} encerrado para suporte e cliente.`;
        toast.className = 'desk-toast success';
        toast.hidden = false;
        setTimeout(() => { toast.hidden = true; }, 3600);
      }

      document.getElementById('deskRefreshBtn')?.click();
    } catch (error) {
      alert(error?.message || 'Não foi possível encerrar o atendimento.');
    } finally {
      button.disabled = false;
      button.textContent = original;
      syncCloseButton();
    }
  }

  function applyFinalizedFilter() {
    if (!finalizedFilterActive || filtering) return;
    filtering = true;
    try {
      const cards = [...document.querySelectorAll('#deskTicketList [data-ticket-id]')];
      let visible = 0;
      cards.forEach(card => {
        const badge = card.querySelector('.desk-badge');
        const isClosed = badge?.classList.contains('closed') || /encerrado/i.test(badge?.textContent || '');
        card.classList.toggle('rrn-finalized-hidden', !isClosed);
        if (isClosed) visible += 1;
      });
      const count = document.getElementById('deskListCount');
      if (count) count.textContent = `${visible} ${visible === 1 ? 'finalizado' : 'finalizados'}`;
      const title = document.getElementById('deskListTitle');
      if (title) title.textContent = 'Chamados finalizados';
    } finally {
      filtering = false;
    }
  }

  function leaveFinalizedFilter() {
    finalizedFilterActive = false;
    document.querySelectorAll('.rrn-finalized-hidden').forEach(el => el.classList.remove('rrn-finalized-hidden'));
    const title = document.getElementById('deskListTitle');
    if (title) title.textContent = 'Fila de atendimento';
  }

  function activateFinalizedFilter(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    finalizedFilterActive = true;

    const allButton = document.querySelector('[data-desk-filter="all"]');
    if (allButton) allButton.click();

    document.querySelectorAll('[data-desk-filter]').forEach(btn => btn.classList.remove('active'));
    event.currentTarget.classList.add('active');
    setTimeout(applyFinalizedFilter, 20);
    setTimeout(applyFinalizedFilter, 120);
  }

  function bind() {
    const close = document.getElementById('deskCloseBtn');
    if (close && close.dataset.rrnBound !== '1') {
      close.dataset.rrnBound = '1';
      close.addEventListener('click', closeTicket, true);
    }

    const finalized = document.querySelector('[data-desk-filter="closed"]');
    if (finalized && finalized.dataset.rrnBound !== '1') {
      finalized.dataset.rrnBound = '1';
      finalized.addEventListener('click', activateFinalizedFilter, true);
    }

    document.querySelectorAll('[data-desk-filter]:not([data-desk-filter="closed"])').forEach(btn => {
      if (btn.dataset.rrnCloseFilterBound === '1') return;
      btn.dataset.rrnCloseFilterBound = '1';
      btn.addEventListener('click', leaveFinalizedFilter, true);
    });
  }

  const observer = new MutationObserver(() => {
    requestAnimationFrame(() => {
      bind();
      syncCloseButton();
      applyFinalizedFilter();
    });
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['hidden','class']
  });

  document.addEventListener('click', event => {
    if (event.target.closest('[data-ticket-id]')) setTimeout(syncCloseButton, 60);
  });

  function boot() {
    bind();
    syncCloseButton();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();

(() => {
  const load = (src, marker) => {
    if (document.querySelector(`script[${marker}]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.setAttribute(marker, '1');
    document.head.appendChild(script);
  };
  load('/js/support-typing-indicator.js?v=20260814-1', 'data-rrn-typing-indicator');
  load('/js/support-desk-empty-state.js?v=20260814-1', 'data-rrn-desk-empty-state');
})();