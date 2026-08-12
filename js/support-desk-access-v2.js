(() => {
  'use strict';
  if (window.__RRN_SUPPORT_DESK_ACCESS_V2__) return;
  window.__RRN_SUPPORT_DESK_ACCESS_V2__ = true;

  const cfg = window.RRN_SUPABASE || {};
  const client = window.supabase?.createClient?.(cfg.url, cfg.anonKey, { auth:{persistSession:true,autoRefreshToken:true} });
  if (!client) return;
  const $ = id => document.getElementById(id);
  let user = null, profile = null, staff = null;
  let bridging = false;

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
    main.innerHTML = `<section class="desk-detail-panel" style="max-width:760px;margin:60px auto;padding:34px"><div class="desk-empty" style="min-height:320px"><div><h2>Acesso restrito à equipe de suporte</h2><p>Seu usuário não está marcado como Técnico ou Gestor de Suporte. Um administrador pode liberar em Configurações → Administração → Usuários.</p><p style="margin-top:18px"><a class="desk-btn primary" href="/usuarios.html">Gerenciar usuários</a> <a class="desk-btn" href="/dashboard.html">Voltar ao painel</a></p></div></div></section>`;
  }

  function syncStaffUi() {
    if (!staff) return;
    const label = $('deskWorkspaceLabel');
    if (label && !label.dataset.supportRoleApplied) {
      label.dataset.supportRoleApplied = '1';
      label.textContent = `${label.textContent.split(' · ')[0] || 'Workspace'} · ${profile?.name || user?.email || 'Usuário'} · ${staff.role === 'manager' ? 'Gestor de suporte' : 'Técnico de suporte'}`;
    }
    if (!bridging) return;
    const view = $('deskTicketView');
    if (!view || view.hidden) return;
    const status = $('deskTicketStatus')?.className || '';
    const closed = /resolved|closed/.test(status);
    if ($('deskActionRow')) $('deskActionRow').hidden = closed;
    ['deskClaimBtn','deskWaitingBtn','deskResolveBtn'].forEach(id => { const el=$(id); if(el) el.hidden=closed; });
    const input = $('deskMessageInput');
    const send = $('deskMessageForm')?.querySelector('button');
    if (input && !/closed/.test(status)) input.disabled = false;
    if (send && !/closed/.test(status)) send.disabled = false;
  }

  async function bridgeClaim(event) {
    if (!bridging) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const ticket = await selectedTicket(); if (!ticket) return;
    const now = new Date().toISOString();
    await client.from('support_tickets').update({ assigned_to:user.id, status:'in_progress', first_response_at:ticket.first_response_at || now, handling_started_at:ticket.handling_started_at || now }).eq('id', ticket.id);
  }

  async function bridgeWaiting(event) {
    if (!bridging) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const id = selectedTicketId(); if (!id) return;
    await client.from('support_tickets').update({ status:'waiting_requester' }).eq('id', id);
  }

  function bridgeOpenResolve(event) {
    if (!bridging) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if ($('deskResolveModal')) $('deskResolveModal').hidden = false;
    $('deskResolutionInput')?.focus();
  }

  async function bridgeResolve(event) {
    if (!bridging) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const ticket = await selectedTicket(); if (!ticket) return;
    const resolution = $('deskResolutionInput')?.value.trim();
    const cause = $('deskCauseInput')?.value.trim();
    if (!resolution) return;
    const now = new Date().toISOString();
    const { error } = await client.from('support_tickets').update({ assigned_to:ticket.assigned_to || user.id, status:'resolved', first_response_at:ticket.first_response_at || now, handling_started_at:ticket.handling_started_at || now, resolved_at:now, resolution, cause:cause || null }).eq('id', ticket.id);
    if (!error && $('deskResolveModal')) $('deskResolveModal').hidden = true;
  }

  async function bridgeMessage(event) {
    if (!bridging) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const id = selectedTicketId();
    const input = $('deskMessageInput');
    const message = input?.value.trim();
    if (!id || !message) return;
    const { error } = await client.from('support_ticket_messages').insert({ ticket_id:id, message });
    if (!error) input.value = '';
  }

  function bindBridge() {
    $('deskClaimBtn')?.addEventListener('click', bridgeClaim, true);
    $('deskWaitingBtn')?.addEventListener('click', bridgeWaiting, true);
    $('deskResolveBtn')?.addEventListener('click', bridgeOpenResolve, true);
    $('deskResolveForm')?.addEventListener('submit', bridgeResolve, true);
    $('deskMessageForm')?.addEventListener('submit', bridgeMessage, true);
    new MutationObserver(syncStaffUi).observe(document.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:['hidden','class'] });
    syncStaffUi();
  }

  async function boot() {
    const { data:{session} } = await client.auth.getSession();
    if (!session?.user) return;
    user = session.user;
    const { data:p } = await client.from('profiles').select('user_id,tenant_id,name,email,role,status').eq('user_id', user.id).maybeSingle();
    profile = p || null;
    if (!profile || profile.status !== 'active') return;
    const { data:s } = await client.from('support_staff').select('id,user_id,tenant_id,role,status').eq('user_id', user.id).eq('tenant_id', profile.tenant_id).eq('status','active').maybeSingle();
    staff = s || null;
    if (!staff) return showDenied();
    bridging = !['admin','operador'].includes(profile.role);
    bindBridge();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 0), { once:true });
  else setTimeout(boot, 0);
})();