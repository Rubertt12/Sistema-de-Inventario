(() => {
  'use strict';
  if (window.__RRN_SUPPORT_TICKET_ASSIGNMENT_V2__) return;
  window.__RRN_SUPPORT_TICKET_ASSIGNMENT_V2__ = true;

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  const state = {
    client: null,
    user: null,
    profile: null,
    agents: [],
    tickets: new Map(),
    assigneeFilter: 'all',
    busy: false,
    ready: false,
    refreshTimer: null,
    listObserver: null,
    channel: null
  };

  async function waitClient() {
    for (let i = 0; i < 80; i += 1) {
      const client = window.RRN_SUPABASE_CLIENT || window.RRN_GET_SUPABASE_CLIENT?.();
      if (client) return client;
      await sleep(50);
    }
    return null;
  }

  function toast(message, type = '') {
    const el = $('deskToast');
    if (!el) return;
    el.textContent = message;
    el.className = `desk-toast ${type}`.trim();
    el.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { el.hidden = true; }, 3600);
  }

  function selectedTicketId() {
    return document.querySelector('#deskTicketList [data-ticket-id].active')?.dataset.ticketId || null;
  }

  function agentLabel(agent) {
    const role = agent.support_role === 'manager' ? 'Gestor' : 'Técnico';
    const count = Number(agent.active_ticket_count || 0);
    return `${agent.name || agent.email || 'Suporte'} · ${role} · ${count} ativo${count === 1 ? '' : 's'}`;
  }

  function optionsSignature(items) {
    return items.map(agent => [agent.user_id, agent.name, agent.email, agent.support_role, agent.active_ticket_count].join('|')).join(';;');
  }

  function setHidden(el, value) {
    if (el && el.hidden !== value) el.hidden = value;
  }

  function ensureUi() {
    if (!state.ready) return;

    const toolbar = document.querySelector('.desk-toolbar');
    if (toolbar && !$('deskAssigneeFilter')) {
      const wrap = document.createElement('label');
      wrap.className = 'desk-assignee-filter-wrap';
      wrap.innerHTML = '<span>Responsável</span><select id="deskAssigneeFilter" aria-label="Filtrar chamados por responsável"></select>';
      toolbar.appendChild(wrap);
      $('deskAssigneeFilter')?.addEventListener('change', event => {
        state.assigneeFilter = event.target.value;
        applyAssigneeFilter();
      });
    }

    const actionRow = $('deskActionRow');
    if (actionRow && !$('deskAssignmentPanel')) {
      const panel = document.createElement('section');
      panel.id = 'deskAssignmentPanel';
      panel.className = 'desk-assignment-panel';
      panel.innerHTML = `
        <div class="desk-assignment-copy">
          <span>Responsável pelo chamado</span>
          <strong id="deskAssignmentName">Não atribuído</strong>
          <small id="deskAssignmentHint">Selecione um integrante da equipe.</small>
        </div>
        <div class="desk-assignment-control">
          <select id="deskAssigneeSelect" aria-label="Responsável pelo chamado"></select>
          <button type="button" class="desk-btn primary" id="deskAssignBtn">Atribuir</button>
          <button type="button" class="desk-btn" id="deskUnassignBtn">Remover</button>
        </div>`;
      actionRow.insertAdjacentElement('beforebegin', panel);

      $('deskAssignBtn')?.addEventListener('click', async () => {
        const value = $('deskAssigneeSelect')?.value || '';
        if (!value) return toast('Selecione um responsável antes de atribuir.', 'error');
        await assignSelected(value);
      });
      $('deskUnassignBtn')?.addEventListener('click', async () => assignSelected(null));
    }

    renderAgentOptions();
    syncSelected();
    applyAssigneeFilter();
    ensureListObserver();
  }

  function renderAgentOptions() {
    const detailSelect = $('deskAssigneeSelect');
    const filterSelect = $('deskAssigneeFilter');
    const signature = optionsSignature(state.agents);

    if (detailSelect && detailSelect.dataset.optionsSignature !== signature) {
      const previous = detailSelect.value;
      detailSelect.innerHTML = '<option value="">Selecione um responsável</option>' + state.agents.map(agent =>
        `<option value="${esc(agent.user_id)}">${esc(agentLabel(agent))}</option>`
      ).join('');
      detailSelect.dataset.optionsSignature = signature;
      if ([...detailSelect.options].some(option => option.value === previous)) detailSelect.value = previous;
    }

    if (filterSelect && filterSelect.dataset.optionsSignature !== signature) {
      const previous = state.assigneeFilter;
      filterSelect.innerHTML = '<option value="all">Todos os responsáveis</option><option value="unassigned">Não atribuídos</option>' + state.agents.map(agent =>
        `<option value="${esc(agent.user_id)}">${esc(agent.name || agent.email || 'Suporte')}</option>`
      ).join('');
      filterSelect.dataset.optionsSignature = signature;
      filterSelect.value = [...filterSelect.options].some(option => option.value === previous) ? previous : 'all';
      state.assigneeFilter = filterSelect.value;
    }
  }

  function syncSelected() {
    const panel = $('deskAssignmentPanel');
    if (!panel) return;
    const id = selectedTicketId();
    const ticket = id ? state.tickets.get(id) : null;
    setHidden(panel, !ticket || ticket.status === 'closed');
    if (!ticket || ticket.status === 'closed') return;

    const agent = state.agents.find(item => item.user_id === ticket.assigned_to);
    const resolved = ticket.status === 'resolved';
    if ($('deskAssignmentName')) $('deskAssignmentName').textContent = agent?.name || (ticket.assigned_to ? 'Suporte atribuído' : 'Não atribuído');
    if ($('deskAssignmentHint')) $('deskAssignmentHint').textContent = resolved
      ? 'Chamado resolvido. A atribuição permanece registrada.'
      : ticket.assigned_to
        ? `Atendimento atribuído para ${agent?.name || 'um integrante da equipe'}.`
        : 'Selecione quem ficará responsável por este atendimento.';

    const select = $('deskAssigneeSelect');
    if (select) {
      if (ticket.assigned_to && ![...select.options].some(option => option.value === ticket.assigned_to)) {
        const option = document.createElement('option');
        option.value = ticket.assigned_to;
        option.textContent = 'Responsável atual';
        select.appendChild(option);
      }
      select.value = ticket.assigned_to || '';
      select.disabled = resolved || state.busy;
    }

    const assign = $('deskAssignBtn');
    if (assign) {
      assign.disabled = resolved || state.busy;
      assign.textContent = state.busy ? 'Atribuindo...' : (ticket.assigned_to ? 'Reatribuir' : 'Atribuir');
    }

    const unassign = $('deskUnassignBtn');
    if (unassign) {
      setHidden(unassign, !ticket.assigned_to || resolved);
      unassign.disabled = resolved || state.busy;
    }
  }

  function applyAssigneeFilter() {
    if (!state.ready) return;
    const cards = [...document.querySelectorAll('#deskTicketList [data-ticket-id]')];
    let visible = 0;
    cards.forEach(card => {
      const ticket = state.tickets.get(card.dataset.ticketId);
      const show = state.assigneeFilter === 'all'
        || (state.assigneeFilter === 'unassigned' && !ticket?.assigned_to)
        || ticket?.assigned_to === state.assigneeFilter;
      card.style.display = show ? '' : 'none';
      if (show) visible += 1;
    });
    const count = $('deskListCount');
    if (count && state.assigneeFilter !== 'all') count.textContent = `${visible} ${visible === 1 ? 'chamado' : 'chamados'} neste responsável`;
  }

  function ensureListObserver() {
    if (state.listObserver) return;
    const list = $('deskTicketList');
    if (!list) return;
    state.listObserver = new MutationObserver(() => {
      applyAssigneeFilter();
      syncSelected();
    });
    state.listObserver.observe(list, { childList: true });
  }

  function scheduleRefresh(delay = 100) {
    clearTimeout(state.refreshTimer);
    state.refreshTimer = setTimeout(refreshDataImmediate, delay);
  }

  async function assignSelected(userId) {
    const id = selectedTicketId();
    if (!id || state.busy) return;
    const current = state.tickets.get(id);
    if (!current || ['resolved', 'closed'].includes(current.status)) return toast('Chamado encerrado não pode ser reatribuído.', 'error');

    state.busy = true;
    syncSelected();
    try {
      const { data, error } = await state.client.rpc('support_assign_ticket', {
        p_ticket_id: id,
        p_assigned_to: userId || null
      });
      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      const name = result?.assigned_name || null;
      toast(name ? `Chamado atribuído para ${name}.` : 'Atribuição removida. O chamado voltou para a fila.', 'success');
      await refreshDataImmediate();
      $('deskRefreshBtn')?.click();
    } catch (error) {
      toast(error.message || 'Não foi possível alterar o responsável.', 'error');
    } finally {
      state.busy = false;
      syncSelected();
    }
  }

  async function refreshDataImmediate() {
    if (!state.ready || !state.profile) return;
    try {
      const [agentsRes, ticketsRes] = await Promise.all([
        state.client.rpc('support_assignment_options'),
        state.client.from('support_tickets').select('id,assigned_to,status').eq('tenant_id', state.profile.tenant_id)
      ]);
      if (agentsRes.error) throw agentsRes.error;
      if (ticketsRes.error) throw ticketsRes.error;
      state.agents = agentsRes.data || [];
      state.tickets.clear();
      (ticketsRes.data || []).forEach(ticket => state.tickets.set(ticket.id, ticket));
      renderAgentOptions();
      syncSelected();
      applyAssigneeFilter();
    } catch (error) {
      console.warn('RRN ticket assignment refresh:', error);
    }
  }

  async function boot() {
    state.client = await waitClient();
    if (!state.client) return;
    const { data: { session } } = await state.client.auth.getSession();
    if (!session?.user) return;
    state.user = session.user;

    const { data: profile, error: profileError } = await state.client
      .from('profiles').select('user_id,tenant_id,name,email,role,status')
      .eq('user_id', session.user.id).maybeSingle();
    if (profileError || !profile || profile.status !== 'active') return;
    state.profile = profile;

    const { data: agents, error } = await state.client.rpc('support_assignment_options');
    if (error) return;
    state.agents = agents || [];
    state.ready = true;
    await refreshDataImmediate();
    ensureUi();

    document.addEventListener('click', event => {
      if (event.target.closest('[data-ticket-id]')) setTimeout(() => { syncSelected(); applyAssigneeFilter(); }, 0);
      else if (event.target.closest('#deskRefreshBtn')) scheduleRefresh(150);
    });

    state.channel = state.client.channel(`rrn-assignment-v2-${profile.tenant_id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'support_tickets', filter: `tenant_id=eq.${profile.tenant_id}` }, () => scheduleRefresh(120))
      .subscribe();

    window.addEventListener('beforeunload', () => {
      state.listObserver?.disconnect();
      if (state.channel) state.client.removeChannel(state.channel);
    }, { once: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 0), { once: true });
  else setTimeout(boot, 0);
})();
