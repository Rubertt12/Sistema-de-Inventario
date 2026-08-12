(() => {
  'use strict';
  if (window.__RRN_SUPPORT_ADMIN_PERMISSIONS__) return;
  window.__RRN_SUPPORT_ADMIN_PERMISSIONS__ = true;

  const cfg = window.RRN_SUPABASE || {};
  const client = window.supabase?.createClient?.(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  if (!client) return;

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const state = { tenantId: null, userId: null, profiles: [], customers: [], staff: [], loading: false };

  function toast(message) {
    const el = $('toast');
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { el.hidden = true; }, 2800);
  }

  function statusLabel(status) {
    return { active: 'Liberado', pending: 'Aguardando aprovação', blocked: 'Bloqueado' }[status] || status || 'Sem acesso';
  }

  function staffLabel(role) {
    return role === 'manager' ? 'Gestor de suporte' : role === 'technician' ? 'Técnico de suporte' : 'Não faz parte';
  }

  function ensureHeaders() {
    const row = document.querySelector('[data-view-panel="users"] table thead tr');
    if (!row || row.querySelector('[data-support-col="portal"]')) return;
    const cells = Array.from(row.children);
    const cadastro = cells.find(cell => /cadastro/i.test(cell.textContent || '')) || cells[cells.length - 2];
    const portal = document.createElement('th');
    portal.dataset.supportCol = 'portal';
    portal.textContent = 'Portal';
    const support = document.createElement('th');
    support.dataset.supportCol = 'staff';
    support.textContent = 'Equipe de suporte';
    row.insertBefore(portal, cadastro || null);
    row.insertBefore(support, cadastro || null);
  }

  function ensureExternalPanel() {
    const view = document.querySelector('[data-view-panel="users"]');
    if (!view || $('supportExternalPanel')) return;
    const panel = document.createElement('div');
    panel.className = 'panel support-access-panel';
    panel.id = 'supportExternalPanel';
    panel.innerHTML = `
      <div class="panel-heading inline-heading">
        <div><span class="eyebrow">Portal de suporte</span><h2>Solicitantes externos</h2><p>Cadastros feitos pelo “Primeiro acesso” ficam pendentes até um administrador liberar.</p></div>
        <span class="counter" id="supportExternalCount">0 solicitantes</span>
      </div>
      <div class="table-wrap"><table><thead><tr><th>Solicitante</th><th>Status</th><th>Cadastro</th><th class="align-right">Ações</th></tr></thead><tbody id="supportExternalBody"><tr><td colspan="4">Carregando...</td></tr></tbody></table></div>`;
    view.appendChild(panel);
  }

  async function loadData() {
    const tenantId = $('tenantSelector')?.value;
    if (!tenantId || state.loading) return;
    state.loading = true;
    state.tenantId = tenantId;
    try {
      const [profilesRes, customersRes, staffRes] = await Promise.all([
        client.from('profiles').select('user_id,name,email,role,status,created_at').eq('tenant_id', tenantId).order('created_at'),
        client.from('support_customers').select('id,user_id,tenant_id,name,email,phone,employee_number,status,created_at,updated_at').eq('tenant_id', tenantId).order('created_at'),
        client.from('support_staff').select('id,user_id,tenant_id,role,status,created_at,updated_at').eq('tenant_id', tenantId).order('created_at')
      ]);
      if (profilesRes.error) throw profilesRes.error;
      if (customersRes.error) throw customersRes.error;
      if (staffRes.error) throw staffRes.error;
      state.profiles = profilesRes.data || [];
      state.customers = customersRes.data || [];
      state.staff = staffRes.data || [];
      renderMemberPermissions();
      renderExternal();
    } catch (error) {
      console.error('RRN support permissions:', error);
      toast(error.message || 'Falha ao carregar permissões de suporte.');
    } finally {
      state.loading = false;
    }
  }

  function renderMemberPermissions() {
    ensureHeaders();
    const customerByUser = new Map(state.customers.map(item => [item.user_id, item]));
    const staffByUser = new Map(state.staff.map(item => [item.user_id, item]));
    document.querySelectorAll('#membersBody tr').forEach(row => {
      const identity = row.querySelector('[data-role-id],[data-status-id]');
      const userId = identity?.dataset.roleId || identity?.dataset.statusId;
      if (!userId) return;
      const cells = Array.from(row.children);
      let portalCell = row.querySelector('[data-support-cell="portal"]');
      let staffCell = row.querySelector('[data-support-cell="staff"]');
      const cadastroCell = cells.find(cell => /^\d{2}\//.test((cell.textContent || '').trim())) || cells[cells.length - 2];
      if (!portalCell) {
        portalCell = document.createElement('td');
        portalCell.dataset.supportCell = 'portal';
        row.insertBefore(portalCell, cadastroCell || row.lastElementChild);
      }
      if (!staffCell) {
        staffCell = document.createElement('td');
        staffCell.dataset.supportCell = 'staff';
        row.insertBefore(staffCell, cadastroCell || row.lastElementChild);
      }

      const customer = customerByUser.get(userId);
      const staff = staffByUser.get(userId);
      const portalStatus = customer?.status || 'none';
      const portalActive = portalStatus === 'active';
      portalCell.innerHTML = `<button type="button" class="support-access-toggle ${portalActive ? 'on' : portalStatus === 'pending' ? 'pending' : ''}" data-portal-user="${userId}" data-portal-active="${portalActive ? '1' : '0'}"><span class="support-switch-dot"></span><span>${portalActive ? 'Pode abrir chamados' : portalStatus === 'pending' ? 'Pendente' : 'Sem acesso'}</span></button>`;
      staffCell.innerHTML = `<select class="support-role-select" data-staff-user="${userId}" aria-label="Função na equipe de suporte"><option value="none" ${!staff || staff.status !== 'active' ? 'selected' : ''}>Não faz parte</option><option value="technician" ${staff?.status === 'active' && staff.role === 'technician' ? 'selected' : ''}>Técnico de suporte</option><option value="manager" ${staff?.status === 'active' && staff.role === 'manager' ? 'selected' : ''}>Gestor de suporte</option></select>`;
    });
  }

  function renderExternal() {
    ensureExternalPanel();
    const body = $('supportExternalBody');
    if (!body) return;
    const profileIds = new Set(state.profiles.map(item => item.user_id));
    const rows = state.customers.filter(item => !profileIds.has(item.user_id));
    $('supportExternalCount').textContent = `${rows.length} ${rows.length === 1 ? 'solicitante' : 'solicitantes'}`;
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="4">Nenhum solicitante externo cadastrado.</td></tr>';
      return;
    }
    body.innerHTML = rows.map(item => {
      const date = item.created_at ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(item.created_at)) : '—';
      const badge = item.status === 'active' ? 'active' : item.status === 'pending' ? 'pending' : 'inactive';
      return `<tr><td class="user-cell"><strong>${esc(item.name || 'Sem nome')}</strong><small>${esc(item.email || '')}${item.employee_number ? ` · Matrícula ${esc(item.employee_number)}` : ''}</small></td><td><span class="badge badge-${badge}">${esc(statusLabel(item.status))}</span></td><td>${date}</td><td class="align-right"><div class="actions">${item.status !== 'active' ? `<button type="button" class="action-btn support-approve" data-customer-action="active" data-customer-id="${item.id}">Liberar portal</button>` : ''}${item.status !== 'blocked' ? `<button type="button" class="action-btn danger" data-customer-action="blocked" data-customer-id="${item.id}">Bloquear</button>` : `<button type="button" class="action-btn" data-customer-action="active" data-customer-id="${item.id}">Reativar</button>`}</div></td></tr>`;
    }).join('');
  }

  async function setPortal(userId, enabled) {
    const profile = state.profiles.find(item => item.user_id === userId);
    if (!profile) return toast('Usuário não encontrado no workspace.');
    const existing = state.customers.find(item => item.user_id === userId);
    let error;
    if (existing) {
      ({ error } = await client.from('support_customers').update({ status: enabled ? 'active' : 'blocked', name: profile.name, email: profile.email }).eq('id', existing.id));
    } else if (enabled) {
      ({ error } = await client.from('support_customers').insert({ user_id: userId, tenant_id: state.tenantId, name: profile.name || profile.email || 'Usuário', email: profile.email || null, status: 'active' }));
    }
    if (error) return toast(error.message || 'Falha ao alterar acesso ao portal.');
    toast(enabled ? 'Acesso ao Portal de Suporte liberado.' : 'Acesso ao Portal de Suporte bloqueado.');
    await loadData();
  }

  async function setStaff(userId, role) {
    const existing = state.staff.find(item => item.user_id === userId);
    let error;
    if (role === 'none') {
      if (!existing) return;
      ({ error } = await client.from('support_staff').update({ status: 'inactive' }).eq('id', existing.id));
    } else if (existing) {
      ({ error } = await client.from('support_staff').update({ role, status: 'active' }).eq('id', existing.id));
    } else {
      ({ error } = await client.from('support_staff').insert({ user_id: userId, tenant_id: state.tenantId, role, status: 'active', created_by: state.userId }));
    }
    if (error) return toast(error.message || 'Falha ao alterar equipe de suporte.');
    toast(role === 'none' ? 'Usuário removido da equipe de suporte.' : `${staffLabel(role)} definido.`);
    await loadData();
  }

  async function setCustomerStatus(id, status) {
    const { error } = await client.from('support_customers').update({ status }).eq('id', id).eq('tenant_id', state.tenantId);
    if (error) return toast(error.message || 'Falha ao atualizar solicitante.');
    toast(status === 'active' ? 'Solicitante liberado para abrir chamados.' : 'Solicitante bloqueado.');
    await loadData();
  }

  function bind() {
    $('membersBody')?.addEventListener('click', event => {
      const button = event.target.closest('[data-portal-user]');
      if (!button) return;
      setPortal(button.dataset.portalUser, button.dataset.portalActive !== '1');
    });
    $('membersBody')?.addEventListener('change', event => {
      const select = event.target.closest('[data-staff-user]');
      if (select) setStaff(select.dataset.staffUser, select.value);
    });
    document.addEventListener('click', event => {
      const button = event.target.closest('[data-customer-action]');
      if (button) setCustomerStatus(button.dataset.customerId, button.dataset.customerAction);
    });
    $('tenantSelector')?.addEventListener('change', () => setTimeout(loadData, 150));
    const body = $('membersBody');
    if (body) new MutationObserver(() => renderMemberPermissions()).observe(body, { childList: true });
  }

  async function boot() {
    ensureHeaders();
    ensureExternalPanel();
    const { data: { session } } = await client.auth.getSession();
    state.userId = session?.user?.id || null;
    bind();
    let attempts = 0;
    const wait = async () => {
      if ($('tenantSelector')?.value) return loadData();
      if (attempts++ < 30) setTimeout(wait, 150);
    };
    wait();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();