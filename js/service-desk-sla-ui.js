(() => {
  'use strict';
  if (window.__RRN_SERVICE_DESK_SLA_UI__) return;
  window.__RRN_SERVICE_DESK_SLA_UI__ = true;

  const cfg = window.RRN_SUPABASE || {};
  const client = window.supabase?.createClient?.(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  if (!client) return;

  const state = { tickets: new Map(), channel: null, fetchTimer: null, paintTimer: null, busy: false };
  const isPortal = Boolean(document.querySelector('.support-portal-body, #supportApp'));
  const isDesk = Boolean(document.querySelector('.desk-body, #deskTicketList'));

  const statusLabels = {
    new: 'Novo',
    assigned: 'Atribuído',
    in_progress: 'Em atendimento',
    waiting_requester: isPortal ? 'Aguardando você' : 'Aguardando colaborador',
    resolved: 'Resolvido',
    closed: 'Encerrado',
    reopened: 'Reaberto'
  };

  function reasonLabel(ticket) {
    const reason = ticket?.sla_pause_reason;
    if (reason === 'maintenance_and_requester') return 'Equipamento em manutenção + aguardando colaborador';
    if (reason === 'maintenance' || ticket?.asset_in_maintenance) return 'Equipamento em manutenção';
    if (reason === 'waiting_requester' || ticket?.status === 'waiting_requester') return 'Aguardando colaborador';
    return 'SLA pausado';
  }

  function visibleStatus(ticket) {
    if (!ticket) return '';
    if (ticket.asset_in_maintenance && !['resolved', 'closed'].includes(ticket.status)) return 'Em manutenção';
    return statusLabels[ticket.status] || ticket.status || 'Chamado';
  }

  function isPaused(ticket) {
    return Boolean(ticket?.sla_paused_at) ||
      (!['resolved', 'closed'].includes(ticket?.status) &&
       (ticket?.asset_in_maintenance || ticket?.status === 'waiting_requester'));
  }

  function ensureStyles() {
    if (document.getElementById('rrn-service-sla-pause-style')) return;
    const style = document.createElement('style');
    style.id = 'rrn-service-sla-pause-style';
    style.textContent = `
      .rrn-sla-paused{color:#8a4a1e!important;font-weight:800!important}
      .rrn-maintenance-ticket-status{background:#fff4e9!important;color:#8a4a1e!important;border-color:rgba(217,119,69,.24)!important}
      .rrn-ticket-maintenance-note{display:flex;align-items:flex-start;gap:9px;margin:10px 0;padding:10px 12px;border:1px solid rgba(217,119,69,.24);border-radius:11px;background:rgba(217,119,69,.08);color:inherit}
      .rrn-ticket-maintenance-note strong,.rrn-ticket-maintenance-note small{display:block}
      .rrn-ticket-maintenance-note strong{font-size:.72rem}
      .rrn-ticket-maintenance-note small{margin-top:2px;color:var(--rrn-muted,#6B7780);font-size:.64rem;line-height:1.4}
      .rrn-ticket-maintenance-note span{font-size:1rem;line-height:1}
      :root[data-theme="dark"] .rrn-ticket-maintenance-note{background:rgba(217,119,69,.12);color:var(--rrn-text,#e6eff1)}
      :root[data-theme="dark"] .rrn-sla-paused{color:#f0b789}
    `;
    document.head.appendChild(style);
  }

  async function fetchTickets() {
    if (state.busy) return;
    state.busy = true;
    try {
      const { data: { session } } = await client.auth.getSession();
      if (!session?.user) {
        state.tickets.clear();
        return;
      }
      const { data, error } = await client
        .from('support_tickets')
        .select('id,ticket_number,status,priority,asset_in_maintenance,sla_paused_at,sla_paused_seconds,sla_pause_reason,first_response_due_at,resolution_due_at,first_response_at,resolved_at,closed_at')
        .order('opened_at', { ascending: false });
      if (error) throw error;
      state.tickets = new Map((data || []).map(ticket => [ticket.id, ticket]));
      paint();
    } catch (error) {
      console.warn('RRN SLA pause UI:', error);
    } finally {
      state.busy = false;
    }
  }

  function activeTicketId() {
    return document.querySelector('.support-ticket-item.active[data-ticket-id]')?.dataset.ticketId ||
      document.querySelector('.desk-ticket-card.active[data-ticket-id]')?.dataset.ticketId ||
      null;
  }

  function setStatusElement(element, ticket) {
    if (!element || !ticket) return;
    element.textContent = visibleStatus(ticket);
    element.classList.toggle('rrn-maintenance-ticket-status', Boolean(ticket.asset_in_maintenance) && !['resolved','closed'].includes(ticket.status));
  }

  function decoratePortalList() {
    document.querySelectorAll('.support-ticket-item[data-ticket-id]').forEach(card => {
      const ticket = state.tickets.get(card.dataset.ticketId);
      if (!ticket) return;
      setStatusElement(card.querySelector('.support-status'), ticket);
      const sla = card.querySelector('.support-ticket-meta small');
      if (sla && isPaused(ticket)) {
        sla.textContent = `SLA pausado · ${reasonLabel(ticket)}`;
        sla.classList.add('rrn-sla-paused');
      } else if (sla) {
        sla.classList.remove('rrn-sla-paused');
      }
    });
  }

  function decorateDeskList() {
    document.querySelectorAll('.desk-ticket-card[data-ticket-id]').forEach(card => {
      const ticket = state.tickets.get(card.dataset.ticketId);
      if (!ticket) return;
      setStatusElement(card.querySelector('.desk-badge'), ticket);
      const sla = card.querySelector('.desk-sla-text');
      if (sla && isPaused(ticket)) {
        sla.textContent = `SLA pausado · ${reasonLabel(ticket)}`;
        sla.classList.remove('overdue');
        sla.classList.add('rrn-sla-paused');
      } else if (sla) {
        sla.classList.remove('rrn-sla-paused');
      }
    });
  }

  function maintenanceNote(ticket, container, mode) {
    if (!container) return;
    let note = container.querySelector(':scope > .rrn-ticket-maintenance-note');
    if (!ticket?.asset_in_maintenance || ['resolved','closed'].includes(ticket.status)) {
      note?.remove();
      return;
    }
    if (!note) {
      note = document.createElement('div');
      note.className = 'rrn-ticket-maintenance-note';
      if (mode === 'portal') container.appendChild(note);
      else container.parentElement?.insertBefore(note, container);
    }
    note.innerHTML = `<span aria-hidden="true">🛠</span><div><strong>Equipamento em manutenção</strong><small>O chamado continua visível e a conversa permanece aberta. O SLA fica pausado até o equipamento sair da manutenção${ticket.status === 'waiting_requester' ? ' e o colaborador responder' : ''}.</small></div>`;
  }

  function decorateSelectedPortal(ticket) {
    if (!ticket) return;
    setStatusElement(document.getElementById('supportTicketStatus'), ticket);
    const label = document.getElementById('supportSlaLabel');
    const value = document.getElementById('supportSlaValue');
    if (isPaused(ticket)) {
      if (label) label.textContent = 'SLA pausado';
      if (value) {
        value.textContent = reasonLabel(ticket);
        value.classList.add('rrn-sla-paused');
      }
    } else if (value) {
      value.classList.remove('rrn-sla-paused');
    }
    maintenanceNote(ticket, document.getElementById('supportTicketAsset'), 'portal');
  }

  function decorateSelectedDesk(ticket) {
    if (!ticket) return;
    setStatusElement(document.getElementById('deskTicketStatus'), ticket);
    const first = document.getElementById('deskFirstResponseSla');
    const resolution = document.getElementById('deskResolutionSla');
    if (isPaused(ticket)) {
      const reason = reasonLabel(ticket);
      if (first && !ticket.first_response_at) {
        first.textContent = `Pausado · ${reason}`;
        first.classList.add('rrn-sla-paused');
      }
      if (resolution && !['resolved','closed'].includes(ticket.status)) {
        resolution.textContent = `Pausado · ${reason}`;
        resolution.classList.add('rrn-sla-paused');
      }
    } else {
      first?.classList.remove('rrn-sla-paused');
      resolution?.classList.remove('rrn-sla-paused');
    }
    maintenanceNote(ticket, document.querySelector('.desk-sla-row'), 'desk');
  }

  function paint() {
    if (isPortal) decoratePortalList();
    if (isDesk) decorateDeskList();
    const id = activeTicketId();
    const ticket = id ? state.tickets.get(id) : null;
    if (isPortal) decorateSelectedPortal(ticket);
    if (isDesk) decorateSelectedDesk(ticket);
  }

  function subscribe() {
    if (state.channel) return;
    state.channel = client
      .channel(`rrn-sla-ui-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => {
        clearTimeout(state.fetchTimer);
        state.fetchTimer = setTimeout(fetchTickets, 120);
      })
      .subscribe();
  }

  async function boot() {
    ensureStyles();
    await fetchTickets();
    subscribe();
    state.paintTimer = setInterval(paint, 450);
    setInterval(fetchTickets, 5000);
    client.auth.onAuthStateChange(() => setTimeout(fetchTickets, 180));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => boot().catch(console.warn), { once: true });
  } else {
    boot().catch(console.warn);
  }
})();