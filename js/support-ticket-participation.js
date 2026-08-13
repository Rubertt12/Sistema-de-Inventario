(() => {
  'use strict';
  if (window.__RRN_SUPPORT_TICKET_PARTICIPATION__) return;
  window.__RRN_SUPPORT_TICKET_PARTICIPATION__ = true;

  const cfg = window.RRN_SUPABASE || {};
  if (!cfg.url || !cfg.anonKey || !window.supabase?.createClient) return;

  const client = window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true }
  });

  const state = {
    user: null,
    profile: null,
    tickets: new Map(),
    pending: [],
    loading: false,
    busy: false,
    timer: null
  };

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  function toast(message, type = '') {
    const el = $('deskToast');
    if (!el) return;
    el.textContent = message;
    el.className = `desk-toast ${type}`.trim();
    el.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { el.hidden = true; }, 3800);
  }

  function selectedTicketId() {
    return document.querySelector('#deskTicketList [data-ticket-id].active')?.dataset.ticketId || null;
  }

  function selectedState() {
    const id = selectedTicketId();
    return id ? state.tickets.get(id) : null;
  }

  function ensurePanel() {
    if ($('deskParticipationPanel')) return $('deskParticipationPanel');
    const detailHead = document.querySelector('.desk-detail-head');
    if (!detailHead) return null;

    const panel = document.createElement('section');
    panel.id = 'deskParticipationPanel';
    panel.className = 'desk-participation-panel';
    panel.hidden = true;
    panel.innerHTML = `
      <div class="desk-participation-copy">
        <span id="deskParticipationEyebrow">Participação na conversa</span>
        <strong id="deskParticipationTitle">Somente visualização</strong>
        <small id="deskParticipationText">Você pode acompanhar o chamado sem interferir no atendimento.</small>
      </div>
      <div class="desk-participation-actions" id="deskParticipationActions"></div>`;

    const assignment = $('deskAssignmentPanel');
    const infoGrid = detailHead.querySelector('.desk-info-grid');
    if (assignment) assignment.insertAdjacentElement('afterend', panel);
    else if (infoGrid) infoGrid.insertAdjacentElement('afterend', panel);
    else detailHead.appendChild(panel);
    return panel;
  }

  function lockAssignmentWhenAssigned(ticket) {
    const panel = $('deskAssignmentPanel');
    if (!panel) return;
    panel.dataset.rrnLocked = ticket?.assigned_to ? '1' : '0';
  }

  function setConversationMode(ticket) {
    const view = $('deskTicketView');
    const input = $('deskMessageInput');
    const form = $('deskMessageForm');
    const send = form?.querySelector('button[type="submit"]');
    if (!view || !ticket) return;

    const assignedToOther = Boolean(ticket.assigned_to && ticket.assigned_to !== state.user?.id);
    const readOnlyActions = assignedToOther;
    const chatLocked = !ticket.can_message;

    view.dataset.rrnReadonlyActions = readOnlyActions ? '1' : '0';
    view.dataset.rrnChatLocked = chatLocked ? '1' : '0';

    if (input) {
      if (!input.dataset.rrnDefaultPlaceholder) input.dataset.rrnDefaultPlaceholder = input.placeholder || 'Responder ao solicitante...';
      input.readOnly = chatLocked;
      input.placeholder = chatLocked
        ? 'Somente visualização — solicite participação para responder.'
        : input.dataset.rrnDefaultPlaceholder;
    }
    if (send) send.setAttribute('aria-disabled', chatLocked ? 'true' : 'false');
  }

  function renderPendingForOwner(ticket, panel) {
    const requests = state.pending.filter(item => item.ticket_id === ticket.ticket_id);
    if (!requests.length) {
      panel.hidden = true;
      return;
    }

    panel.hidden = false;
    $('deskParticipationEyebrow').textContent = 'Solicitações de participação';
    $('deskParticipationTitle').textContent = requests.length === 1
      ? '1 pessoa quer participar da conversa'
      : `${requests.length} pessoas querem participar da conversa`;
    $('deskParticipationText').textContent = 'A aprovação permite conversar, mas não transfere a responsabilidade do chamado.';
    $('deskParticipationActions').innerHTML = requests.map(req => `
      <div class="desk-participation-request">
        <div><strong>${esc(req.requester_name || req.requester_email || 'Admin')}</strong><small>${esc(req.requester_email || '')}</small></div>
        <div class="desk-participation-request-actions">
          <button type="button" class="desk-btn success" data-participation-review="approve" data-requester-id="${esc(req.requester_id)}">Aprovar</button>
          <button type="button" class="desk-btn" data-participation-review="decline" data-requester-id="${esc(req.requester_id)}">Recusar</button>
        </div>
      </div>`).join('');
  }

  function renderObserver(ticket, panel) {
    panel.hidden = false;
    const status = ticket.my_status || '';
    const assignedName = ticket.assigned_name || 'o suporte responsável';

    $('deskParticipationEyebrow').textContent = 'Participação na conversa';

    if (status === 'approved') {
      $('deskParticipationTitle').textContent = 'Participação aprovada';
      $('deskParticipationText').textContent = `Você pode conversar neste chamado. ${assignedName} continua como responsável pelo atendimento.`;
      $('deskParticipationActions').innerHTML = '<span class="desk-participation-status approved">Participante</span>';
      return;
    }

    if (status === 'pending') {
      $('deskParticipationTitle').textContent = 'Solicitação enviada';
      $('deskParticipationText').textContent = `Aguardando ${assignedName} aprovar sua entrada na conversa.`;
      $('deskParticipationActions').innerHTML = '<span class="desk-participation-status pending">Aguardando aprovação</span>';
      return;
    }

    if (status === 'declined') {
      $('deskParticipationTitle').textContent = 'Participação não aprovada';
      $('deskParticipationText').textContent = `Você continua como observador. Se necessário, pode solicitar novamente a ${assignedName}.`;
    } else {
      $('deskParticipationTitle').textContent = 'Somente visualização';
      $('deskParticipationText').textContent = `${assignedName} é o responsável. Você pode acompanhar o histórico e pedir para participar da conversa.`;
    }

    $('deskParticipationActions').innerHTML = ticket.can_request
      ? '<button type="button" class="desk-btn primary" id="deskRequestParticipationBtn">Pedir para participar da conversa</button>'
      : '<span class="desk-participation-status observer">Observador</span>';
  }

  function reconcile() {
    const ticket = selectedState();
    const panel = ensurePanel();
    if (!panel) return;

    if (!ticket) {
      panel.hidden = true;
      return;
    }

    lockAssignmentWhenAssigned(ticket);
    setConversationMode(ticket);

    if (ticket.assigned_to === state.user?.id) {
      renderPendingForOwner(ticket, panel);
      return;
    }

    if (ticket.assigned_to) {
      renderObserver(ticket, panel);
      return;
    }

    panel.hidden = true;
  }

  async function loadState() {
    if (state.loading || !state.profile) return;
    state.loading = true;
    try {
      const [ticketsRes, pendingRes] = await Promise.all([
        client.rpc('support_my_ticket_participation'),
        client.rpc('support_pending_participation_requests')
      ]);

      if (ticketsRes.error) throw ticketsRes.error;
      state.tickets.clear();
      (ticketsRes.data || []).forEach(row => state.tickets.set(row.ticket_id, row));
      state.pending = pendingRes.error ? [] : (pendingRes.data || []);
      reconcile();
    } catch (error) {
      console.warn('RRN participation state:', error);
    } finally {
      state.loading = false;
    }
  }

  async function requestParticipation() {
    const ticket = selectedState();
    if (!ticket || state.busy || !ticket.can_request) return;
    state.busy = true;
    try {
      const { error } = await client.rpc('support_request_ticket_participation', {
        p_ticket_id: ticket.ticket_id
      });
      if (error) throw error;
      toast('Solicitação enviada ao responsável pelo chamado.', 'success');
      await loadState();
    } catch (error) {
      toast(error.message || 'Não foi possível solicitar participação.', 'error');
    } finally {
      state.busy = false;
    }
  }

  async function reviewParticipation(requesterId, approve) {
    const ticket = selectedState();
    if (!ticket || state.busy || !requesterId) return;
    state.busy = true;
    try {
      const { error } = await client.rpc('support_review_ticket_participation', {
        p_ticket_id: ticket.ticket_id,
        p_requester_id: requesterId,
        p_approve: Boolean(approve)
      });
      if (error) throw error;
      toast(approve ? 'Participação aprovada.' : 'Solicitação recusada.', approve ? 'success' : '');
      await loadState();
    } catch (error) {
      toast(error.message || 'Não foi possível responder à solicitação.', 'error');
    } finally {
      state.busy = false;
    }
  }

  function bind() {
    $('deskTicketList')?.addEventListener('click', () => setTimeout(() => {
      reconcile();
      loadState();
    }, 80));

    $('deskRefreshBtn')?.addEventListener('click', () => setTimeout(loadState, 120));

    document.addEventListener('click', event => {
      if (event.target.closest('#deskRequestParticipationBtn')) {
        event.preventDefault();
        requestParticipation();
        return;
      }
      const review = event.target.closest('[data-participation-review]');
      if (review) {
        event.preventDefault();
        reviewParticipation(review.dataset.requesterId, review.dataset.participationReview === 'approve');
      }
    });

    const form = $('deskMessageForm');
    form?.addEventListener('submit', event => {
      const ticket = selectedState();
      if (ticket && !ticket.can_message) {
        event.preventDefault();
        event.stopImmediatePropagation();
        toast('Você está como observador. Peça para participar antes de responder.', 'error');
      }
    }, true);

    const actionRow = $('deskActionRow');
    actionRow?.addEventListener('click', event => {
      const ticket = selectedState();
      if (ticket?.assigned_to && ticket.assigned_to !== state.user?.id) {
        event.preventDefault();
        event.stopImmediatePropagation();
        toast('O chamado já está com outro responsável. Você está em modo de observação.', 'error');
      }
    }, true);
  }

  async function boot() {
    const { data: { session } } = await client.auth.getSession();
    if (!session?.user) return;
    state.user = session.user;

    const { data: profile, error } = await client
      .from('profiles')
      .select('user_id,tenant_id,name,email,role,status')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (error || !profile || profile.status !== 'active') return;
    state.profile = profile;

    bind();
    await loadState();
    clearInterval(state.timer);
    state.timer = setInterval(loadState, 5000);
    window.addEventListener('beforeunload', () => clearInterval(state.timer), { once: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 0), { once: true });
  } else {
    setTimeout(boot, 0);
  }
})();
