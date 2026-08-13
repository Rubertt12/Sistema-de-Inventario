(() => {
  'use strict';
  if (window.__RRN_SUPPORT_DESK_ACCESS_V2__) return;
  window.__RRN_SUPPORT_DESK_ACCESS_V2__ = true;

  const cfg = window.RRN_SUPABASE || {};
  const client = window.supabase?.createClient?.(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true }
  });
  if (!client) return;

  const $ = id => document.getElementById(id);
  let user = null;
  let profile = null;
  let staff = null;
  let bridging = false;
  let monitoring = false;
  let uiObserver = null;

  function selectedTicketId() {
    return document.querySelector('[data-ticket-id].active')?.dataset.ticketId || null;
  }

  async function selectedTicket() {
    const id = selectedTicketId();
    if (!id) return null;
    const { data } = await client.from('support_tickets').select('*').eq('id', id).maybeSingle();
    return data || null;
  }

  function showDenied() {
    const main = document.querySelector('.desk-main');
    if (!main) return;
    main.innerHTML = `<section class="desk-detail-panel" style="max-width:760px;margin:60px auto;padding:34px"><div class="desk-empty" style="min-height:320px"><div><h2>Acesso restrito à Central de Chamados</h2><p>Seu usuário precisa ser Técnico, Gestor de Suporte ou possuir o perfil Monitoramento.</p><p style="margin-top:18px"><a class="desk-btn primary" href="/usuarios.html">Gerenciar usuários</a> <a class="desk-btn" href="/dashboard.html">Voltar ao painel</a></p></div></div></section>`;
  }

  function setHidden(el, value) {
    if (el && el.hidden !== value) el.hidden = value;
  }

  function setDisabled(el, value) {
    if (el && el.disabled !== value) el.disabled = value;
  }

  function applyWorkspaceLabel() {
    const label = $('deskWorkspaceLabel');
    if (!label || label.dataset.supportRoleApplied) return;
    label.dataset.supportRoleApplied = '1';
    const workspace = (label.textContent || 'Workspace').split(' · ')[0] || 'Workspace';
    const roleLabel = monitoring
      ? 'Monitoramento · distribuição de chamados'
      : staff?.role === 'manager'
        ? 'Gestor de suporte'
        : 'Técnico de suporte';
    label.textContent = `${workspace} · ${profile?.name || user?.email || 'Usuário'} · ${roleLabel}`;
  }

  function syncMonitoringUi() {
    if (!monitoring) return;
    applyWorkspaceLabel();

    setHidden($('deskActionRow'), true);
    setHidden($('deskClaimBtn'), true);
    setHidden($('deskWaitingBtn'), true);
    setHidden($('deskResolveBtn'), true);

    const input = $('deskMessageInput');
    const send = $('deskMessageForm')?.querySelector('button[type="submit"]');
    if (input) {
      input.readOnly = true;
      input.placeholder = 'Monitoramento acompanha o chamado em tempo real e distribui para a equipe.';
      setDisabled(input, true);
    }
    if (send) setDisabled(send, true);

    const assignment = $('deskAssignmentPanel');
    if (assignment) {
      assignment.dataset.rrnLocked = '0';
      const hint = $('deskAssignmentHint');
      if (hint) hint.textContent = 'Monitoramento pode atribuir ou reatribuir este chamado para um suporte ativo.';
      const select = $('deskAssigneeSelect');
      const unassign = $('deskUnassignBtn');
      const closed = /resolved|closed/.test($('deskTicketStatus')?.className || '');
      if (select) setDisabled(select, closed);
      if (unassign) setDisabled(unassign, closed);
    }
  }

  function syncStaffUi() {
    applyWorkspaceLabel();
    if (monitoring) return syncMonitoringUi();
    if (!staff || !bridging) return;

    const view = $('deskTicketView');
    if (!view || view.hidden) return;
    const statusClass = $('deskTicketStatus')?.className || '';
    const closed = /resolved|closed/.test(statusClass);
    setHidden($('deskActionRow'), closed);
    setHidden($('deskClaimBtn'), closed);
    setHidden($('deskWaitingBtn'), closed);
    setHidden($('deskResolveBtn'), closed);

    const input = $('deskMessageInput');
    const send = $('deskMessageForm')?.querySelector('button');
    if (input && !closed && input.disabled) input.disabled = false;
    if (send && !closed && send.disabled) send.disabled = false;
  }

  async function bridgeClaim(event) {
    if (!bridging) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const ticket = await selectedTicket();
    if (!ticket) return;
    const now = new Date().toISOString();
    await client.from('support_tickets').update({
      assigned_to: user.id,
      status: 'in_progress',
      first_response_at: ticket.first_response_at || now,
      handling_started_at: ticket.handling_started_at || now
    }).eq('id', ticket.id);
  }

  async function bridgeWaiting(event) {
    if (!bridging) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const id = selectedTicketId();
    if (!id) return;
    await client.from('support_tickets').update({ status: 'waiting_requester' }).eq('id', id);
  }

  function bridgeOpenResolve(event) {
    if (!bridging) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    setHidden($('deskResolveModal'), false);
    $('deskResolutionInput')?.focus();
  }

  async function bridgeResolve(event) {
    if (!bridging) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const ticket = await selectedTicket();
    if (!ticket) return;
    const resolution = $('deskResolutionInput')?.value.trim();
    const cause = $('deskCauseInput')?.value.trim();
    if (!resolution) return;
    const now = new Date().toISOString();
    const { error } = await client.from('support_tickets').update({
      assigned_to: ticket.assigned_to || user.id,
      status: 'resolved',
      first_response_at: ticket.first_response_at || now,
      handling_started_at: ticket.handling_started_at || now,
      resolved_at: now,
      resolution,
      cause: cause || null
    }).eq('id', ticket.id);
    if (!error) setHidden($('deskResolveModal'), true);
  }

  async function bridgeMessage(event) {
    if (!bridging) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const id = selectedTicketId();
    const input = $('deskMessageInput');
    const message = input?.value.trim();
    if (!id || !message) return;
    const { error } = await client.from('support_ticket_messages').insert({ ticket_id: id, message });
    if (!error) input.value = '';
  }

  function bindUi() {
    if (bridging) {
      $('deskClaimBtn')?.addEventListener('click', bridgeClaim, true);
      $('deskWaitingBtn')?.addEventListener('click', bridgeWaiting, true);
      $('deskResolveBtn')?.addEventListener('click', bridgeOpenResolve, true);
      $('deskResolveForm')?.addEventListener('submit', bridgeResolve, true);
      $('deskMessageForm')?.addEventListener('submit', bridgeMessage, true);
    }

    const root = $('deskTicketView') || document.querySelector('.desk-main') || document.body;
    uiObserver = new MutationObserver(syncStaffUi);
    uiObserver.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['hidden', 'class', 'disabled']
    });
    syncStaffUi();
  }

  async function boot() {
    const { data: { session } } = await client.auth.getSession();
    if (!session?.user) return;
    user = session.user;

    const { data: p } = await client.from('profiles')
      .select('user_id,tenant_id,name,email,role,status')
      .eq('user_id', user.id)
      .maybeSingle();
    profile = p || null;
    if (!profile || profile.status !== 'active') return;

    monitoring = profile.role === 'monitoramento';

    const { data: s } = await client.from('support_staff')
      .select('id,user_id,tenant_id,role,status')
      .eq('user_id', user.id)
      .eq('tenant_id', profile.tenant_id)
      .eq('status', 'active')
      .maybeSingle();
    staff = s || null;

    if (!staff && !monitoring) return showDenied();

    bridging = Boolean(staff) && !monitoring && !['admin', 'operador'].includes(profile.role);
    bindUi();
  }

  window.addEventListener('beforeunload', () => uiObserver?.disconnect(), { once: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 0), { once: true });
  } else {
    setTimeout(boot, 0);
  }
})();

(() => {
  'use strict';
  if (window.__RRN_SUPPORT_DESK_SLA_LOADER__) return;
  window.__RRN_SUPPORT_DESK_SLA_LOADER__ = true;
  if (document.querySelector('script[data-rrn-service-desk-sla-ui]')) return;
  const script = document.createElement('script');
  script.src = '/js/service-desk-sla-ui.js';
  script.async = false;
  script.setAttribute('data-rrn-service-desk-sla-ui', '1');
  document.head.appendChild(script);
})();