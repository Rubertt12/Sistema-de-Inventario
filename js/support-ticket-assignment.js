(() => {
  'use strict';
  if (window.__RRN_SUPPORT_TICKET_ASSIGNMENT__) return;
  window.__RRN_SUPPORT_TICKET_ASSIGNMENT__ = true;

  const cfg = window.RRN_SUPABASE || {};
  if (!cfg.url || !cfg.anonKey || !window.supabase?.createClient) return;

  const client = window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true }
  });

  const state = {
    user: null,
    profile: null,
    agents: [],
    tickets: new Map(),
    filter: 'all',
    busy: false,
    ready: false,
    refreshTimer: null,
    listObserver: null
  };

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

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

  function optionsSignature(items, includeCounts = true) {
    return items.map(agent => [agent.user_id, agent.name, agent.email, agent.support_role, includeCounts ? agent.active_ticket_count : ''].join('|')).join(';;');
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
        state.filter = event.target.value;
        applyFilter();
      });
    }

    const detailHead = document.querySelector('.desk-detail-head');
    const infoGrid = detailHead?.querySelector('.desk-info-grid');
    if (detailHead && infoGrid && !$('deskAssignmentPanel')) {
      const panel = document.createElement('section');
      panel.id = 'deskAssignmentPanel';
      panel.className = 'desk-assignment-panel';
      panel.innerHTML = `
        <div class="desk-assignment-copy">
          <span>Responsável pelo atendimento</span>
          <strong id="deskAssignmentName">Não atribuído</strong>
          <small id="deskAssignmentHint">Admin ou Gestor pode direcionar este chamado para a equipe de suporte.</small>
        </div>
        <div class="desk-assignment-control">
          <select id="deskAssigneeSelect" aria-label="Responsável pelo chamado"></select>
          <button type="button" class="desk-btn" id="deskUnassignBtn">Remover atribuição</button>
        </div>`;
      infoGrid.insertAdjacentElement('afterend', panel);

      $('deskAssigneeSelect')?.addEventListener('change', async event => {
        await assignSelected(event.target.value || null);
      });
      $('deskUnassignBtn')?.addEventListener('click', async () => assignSelected(null));
    }

    renderAgentOptions();
    syncSelected();
    applyFilter();
    ensureListObserver();
  }

  function renderAgentOptions() {
    const detailSelect = $('deskAssigneeSelect');
    const filterSelect = $('deskAssigneeFilter');
    const signature = optionsSignature(state.agents);

    if (detailSelect && detailSelect.dataset.optionsSignature !== signature) {
      const previous = detailSelect.value;
      detailSelect.innerHTML = '<option value="">Não atribuído</option>' + state.agents.map(agent =>
        `<option value="${esc(agent.user_id)}">${esc(agentLabel(agent))}</option>`
      ).join('');
      detailSelect.dataset.optionsSignature = signature;
      if ([...detailSelect.options].some(option => option.value === previous)) detailSelect.value = previous;
    }

    if (filterSelect && filterSelect.dataset.optionsSignature !== signature) {
      const previous = state.filter;
      filterSelect.innerHTML = '<option value="all">Todos os responsáveis</option><option value="unassigned">Não atribuídos</option>' + state.agents.map(agent =>
        `<option value="${esc(agent.user_id)}">${esc(agent.name || agent.email || 'Suporte')}</option>`
      ).join('');
      filterSelect.dataset.optionsSignature = signature;
      filterSelect.value = [...filterSelect.options].some(option => option.value === previous) ? previous : 'all';
      state.filter = filterSelect.value;
    }
  }

  function setHidden(el, value) {
    if (el && el.hidden !== value) el.hidden = value;
  }

  function syncSelected() {
    const panel = $('deskAssignmentPanel');
    if (!panel) return;
    const id = selectedTicketId();
    const ticket = id ? state.tickets.get(id) : null;
    setHidden(panel, !ticket);
    if (!ticket) return;

    const agent = state.agents.find(item => item.user_id === ticket.assigned_to);
    const closed = ['resolved', 'closed'].includes(ticket.status);
    if ($('deskAssignmentName')) $('deskAssignmentName').textContent = agent?.name || (ticket.assigned_to ? 'Suporte atribuído' : 'Não atribuído');
    if ($('deskAssignmentHint')) {
      $('deskAssignmentHint').textContent = closed
        ? 'Chamado encerrado. A atribuição fica preservada no histórico.'
        : ticket.assigned_to
          ? `Atendimento direcionado para ${agent?.name || 'um integrante da equipe'}.`
          : 'Chamado disponível para distribuição pela gestão.';
    }

    const select = $('deskAssigneeSelect');
    if (select) {
      if (ticket.assigned_to && ![...select.options].some(option => option.value === ticket.assigned_to)) {
        const option = document.createElement('option');
        option.value = ticket.assigned_to;
        option.textContent = 'Responsável atual';
        select.appendChild(option);
      }
      if (select.value !== (ticket.assigned_to || '')) select.value = ticket.assigned_to || '';
      select.disabled = closed || state.busy;
    }

    const unassign = $('deskUnassignBtn');
    if (unassign) {
      setHidden(unassign, !ticket.assigned_to);
      unassign.disabled = closed || state.busy;
    }
  }

  function applyFilter() {
    if (!state.ready) return;
    const cards = [...document.querySelectorAll('#deskTicketList [data-ticket-id]')];
    if (!cards.length) return;
    let visible = 0;
    cards.forEach(card => {
      const ticket = state.tickets.get(card.dataset.ticketId);
      const show = state.filter === 'all'
        || (state.filter === 'unassigned' && !ticket?.assigned_to)
        || ticket?.assigned_to === state.filter;
      setHidden(card, !show);
      if (show) visible += 1;
    });
    const count = $('deskListCount');
    if (count && state.filter !== 'all') count.textContent = `${visible} ${visible === 1 ? 'chamado' : 'chamados'} neste responsável`;
  }

  function ensureListObserver() {
    if (state.listObserver) return;
    const list = $('deskTicketList');
    if (!list) return;
    state.listObserver = new MutationObserver(() => {
      applyFilter();
      syncSelected();
    });
    state.listObserver.observe(list, { childList: true });
  }

  function scheduleRefresh(delay = 100) {
    clearTimeout(state.refreshTimer);
    state.refreshTimer = setTimeout(() => refreshDataImmediate(), delay);
  }

  async function assignSelected(userId) {
    const id = selectedTicketId();
    if (!id || state.busy) return;
    const current = state.tickets.get(id);
    if (!current || ['resolved', 'closed'].includes(current.status)) {
      toast('Chamado encerrado não pode ser reatribuído.', 'error');
      return;
    }

    state.busy = true;
    syncSelected();
    try {
      const { data, error } = await client.rpc('support_assign_ticket', {
        p_ticket_id: id,
        p_assigned_to: userId || null
      });
      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      const name = result?.assigned_name || null;
      toast(name ? `Chamado atribuído para ${name}.` : 'Atribuição removida. O chamado voltou para a fila.', 'success');
      $('deskRefreshBtn')?.click();
      await refreshDataImmediate();
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
        client.rpc('support_assignment_options'),
        client.from('support_tickets').select('id,assigned_to,status').eq('tenant_id', state.profile.tenant_id)
      ]);
      if (agentsRes.error) throw agentsRes.error;
      if (ticketsRes.error) throw ticketsRes.error;

      state.agents = agentsRes.data || [];
      state.tickets.clear();
      (ticketsRes.data || []).forEach(ticket => state.tickets.set(ticket.id, ticket));
      renderAgentOptions();
      syncSelected();
      applyFilter();
    } catch (error) {
      console.warn('RRN ticket assignment refresh:', error);
    }
  }

  async function boot() {
    const { data: { session } } = await client.auth.getSession();
    if (!session?.user) return;
    state.user = session.user;

    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('user_id,tenant_id,name,email,role,status')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (profileError || !profile || profile.status !== 'active') return;
    state.profile = profile;

    const { data: agents, error } = await client.rpc('support_assignment_options');
    if (error) return;

    state.agents = agents || [];
    state.ready = true;
    await refreshDataImmediate();
    ensureUi();

    document.addEventListener('click', event => {
      if (event.target.closest('[data-ticket-id]')) {
        setTimeout(() => {
          syncSelected();
          applyFilter();
        }, 0);
      } else if (event.target.closest('#deskRefreshBtn')) {
        scheduleRefresh(150);
      }
    });

    const channel = client.channel(`rrn-assignment-${profile.tenant_id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'support_tickets',
        filter: `tenant_id=eq.${profile.tenant_id}`
      }, () => scheduleRefresh(120))
      .subscribe();

    window.addEventListener('beforeunload', () => {
      if (state.listObserver) state.listObserver.disconnect();
      client.removeChannel(channel);
    }, { once: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 0), { once: true });
  } else {
    setTimeout(boot, 0);
  }
})();
