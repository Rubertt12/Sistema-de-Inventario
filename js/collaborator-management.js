(() => {
  'use strict';
  if (window.__RRN_COLLABORATOR_MANAGEMENT__) return;
  window.__RRN_COLLABORATOR_MANAGEMENT__ = true;

  const cfg = window.RRN_SUPABASE || {};
  const client = window.supabase?.createClient?.(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  if (!client) return;

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const state = { tenantId: null, collaborators: [], assets: [], profiles: [], customers: [], editing: null, assetDraft: new Map(), busy: false };

  function toast(message) {
    const el = $('toast');
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { el.hidden = true; }, 3000);
  }

  function selectedTenantId() { return $('tenantSelector')?.value || null; }
  function normalizeEmail(value) { return String(value || '').trim().toLowerCase(); }
  function collaboratorForUser(userId) { return state.collaborators.find(c => c.user_id === userId) || null; }
  function assetsForCollaborator(id) { return state.assets.filter(a => a.collaborator_id === id); }
  function portalForUser(userId) { return state.customers.find(c => c.user_id === userId) || null; }

  function ensureNavAndView() {
    const nav = document.querySelector('.admin-nav');
    if (nav && !nav.querySelector('[data-view="collaborators"]')) {
      const usersButton = nav.querySelector('[data-view="users"]');
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.view = 'collaborators';
      button.textContent = 'Colaboradores';
      if (usersButton?.nextSibling) nav.insertBefore(button, usersButton.nextSibling);
      else nav.appendChild(button);
      button.addEventListener('click', () => switchToCollaborators());
    }

    const content = document.querySelector('.admin-content');
    if (!content || document.querySelector('[data-view-panel="collaborators"]')) return;
    const section = document.createElement('section');
    section.className = 'view collaborator-view';
    section.dataset.viewPanel = 'collaborators';
    section.innerHTML = `
      <div class="page-heading collaborator-heading">
        <div><span class="eyebrow">Pessoas e patrimônio</span><h1>Colaboradores</h1><p>Cadastre quem utiliza os equipamentos da empresa e associe os ativos sob responsabilidade de cada pessoa.</p></div>
        <span class="counter" id="collaboratorCount">0 colaboradores</span>
      </div>
      <div class="collaborator-kpis">
        <article><span>Colaboradores ativos</span><strong id="collabKpiActive">0</strong><small>responsáveis cadastrados</small></article>
        <article><span>Ativos vinculados</span><strong id="collabKpiLinked">0</strong><small>com responsável definido</small></article>
        <article><span>Sem responsável</span><strong id="collabKpiUnlinked">0</strong><small>disponíveis para associação</small></article>
      </div>
      <div class="panel">
        <div class="panel-heading"><span class="eyebrow">Novo colaborador</span><h2>Cadastro do responsável</h2><p>O colaborador não ganha acesso administrativo ao RRN Manager. Portal de suporte é uma permissão separada.</p></div>
        <form id="collaboratorForm" class="collaborator-form">
          <label class="field"><span>Nome completo</span><input id="collaboratorName" required placeholder="Ex: João da Silva"></label>
          <label class="field"><span>E-mail</span><input id="collaboratorEmail" type="email" placeholder="joao@empresa.com"></label>
          <label class="field"><span>Matrícula</span><input id="collaboratorEmployee" placeholder="Ex: 716594"></label>
          <label class="field"><span>Setor / departamento</span><input id="collaboratorDepartment" placeholder="Ex: Comercial"></label>
          <button class="btn-primary" type="submit" id="collaboratorCreateBtn">Cadastrar colaborador</button>
        </form>
      </div>
      <div class="panel">
        <div class="panel-heading inline-heading"><div><span class="eyebrow">Responsáveis</span><h2>Colaboradores cadastrados</h2></div><input class="collaborator-search" id="collaboratorSearch" type="search" placeholder="Buscar nome, e-mail ou matrícula"></div>
        <div class="table-wrap"><table><thead><tr><th>Colaborador</th><th>Tipo</th><th>Portal</th><th>Equipamentos</th><th>Status</th><th class="align-right">Ações</th></tr></thead><tbody id="collaboratorsBody"></tbody></table></div>
      </div>`;
    content.appendChild(section);

    const modal = document.createElement('div');
    modal.className = 'collaborator-modal';
    modal.id = 'collaboratorAssetsModal';
    modal.hidden = true;
    modal.innerHTML = `<div class="collaborator-modal-card"><div class="collaborator-modal-head"><div><span class="eyebrow">Patrimônio</span><h2 id="collaboratorAssetsTitle">Equipamentos do colaborador</h2><p id="collaboratorAssetsSubtitle">Marque os equipamentos sob responsabilidade desta pessoa.</p></div><button type="button" class="collaborator-modal-close" data-collab-close>×</button></div><input id="collaboratorAssetSearch" class="collaborator-search wide" type="search" placeholder="Buscar patrimônio, serial, nome ou setor"><div class="collaborator-assets-list" id="collaboratorAssetsList"></div><div class="collaborator-modal-actions"><button type="button" class="btn-secondary" data-collab-close>Cancelar</button><button type="button" class="btn-primary" id="saveCollaboratorAssets">Salvar associações</button></div></div>`;
    document.body.appendChild(modal);

    bindDynamic();
  }

  function switchToCollaborators() {
    document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === 'collaborators'));
    document.querySelectorAll('[data-view-panel]').forEach(p => p.classList.toggle('active', p.dataset.viewPanel === 'collaborators'));
    loadData().catch(error => toast(error.message || 'Falha ao carregar colaboradores.'));
  }

  async function loadData() {
    const tenantId = selectedTenantId();
    if (!tenantId || state.busy) return;
    state.busy = true;
    state.tenantId = tenantId;
    try {
      const [collabRes, assetRes, profileRes, customerRes] = await Promise.all([
        client.from('collaborators').select('id,tenant_id,user_id,name,email,employee_number,department,status,created_at,updated_at').eq('tenant_id', tenantId).order('name'),
        client.rpc('admin_list_inventory_assets', { p_tenant_id: tenantId }),
        client.from('profiles').select('user_id,name,email,role,status').eq('tenant_id', tenantId),
        client.from('support_customers').select('id,user_id,name,email,status').eq('tenant_id', tenantId)
      ]);
      if (collabRes.error) throw collabRes.error;
      if (assetRes.error) throw assetRes.error;
      if (profileRes.error) throw profileRes.error;
      if (customerRes.error) throw customerRes.error;
      state.collaborators = collabRes.data || [];
      state.assets = assetRes.data || [];
      state.profiles = profileRes.data || [];
      state.customers = customerRes.data || [];
      render();
      annotateMembers();
    } finally {
      state.busy = false;
    }
  }

  function render() {
    const active = state.collaborators.filter(c => c.status === 'active').length;
    const linked = state.assets.filter(a => a.collaborator_id).length;
    const unlinked = state.assets.length - linked;
    if ($('collaboratorCount')) $('collaboratorCount').textContent = `${state.collaborators.length} ${state.collaborators.length === 1 ? 'colaborador' : 'colaboradores'}`;
    if ($('collabKpiActive')) $('collabKpiActive').textContent = active;
    if ($('collabKpiLinked')) $('collabKpiLinked').textContent = linked;
    if ($('collabKpiUnlinked')) $('collabKpiUnlinked').textContent = unlinked;
    renderTable();
  }

  function renderTable() {
    const body = $('collaboratorsBody');
    if (!body) return;
    const q = String($('collaboratorSearch')?.value || '').trim().toLowerCase();
    const rows = state.collaborators.filter(c => !q || [c.name,c.email,c.employee_number,c.department].some(v => String(v || '').toLowerCase().includes(q)));
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="6">Nenhum colaborador encontrado.</td></tr>';
      return;
    }
    body.innerHTML = rows.map(c => {
      const linkedAssets = assetsForCollaborator(c.id);
      const portal = c.user_id ? portalForUser(c.user_id) : null;
      const portalLabel = portal?.status === 'active' ? 'Liberado' : portal?.status === 'pending' ? 'Pendente' : portal?.status === 'blocked' ? 'Bloqueado' : 'Sem acesso';
      const portalClass = portal?.status === 'active' ? 'active' : portal?.status === 'pending' ? 'pending' : 'inactive';
      return `<tr>
        <td class="user-cell"><strong>${esc(c.name)}</strong><small>${[c.email,c.employee_number ? `Matrícula ${c.employee_number}` : null,c.department].filter(Boolean).map(esc).join(' · ') || 'Sem dados adicionais'}</small></td>
        <td><span class="collaborator-type-badge">Colaborador</span></td>
        <td><span class="badge badge-${portalClass}">${esc(portalLabel)}</span></td>
        <td><button class="collaborator-assets-button" type="button" data-collab-assets="${c.id}">${linkedAssets.length} ${linkedAssets.length === 1 ? 'equipamento' : 'equipamentos'}</button></td>
        <td><span class="badge badge-${c.status === 'active' ? 'active' : 'inactive'}">${c.status === 'active' ? 'Ativo' : 'Inativo'}</span></td>
        <td class="align-right"><div class="actions"><button class="action-btn" type="button" data-collab-edit="${c.id}">Editar</button><button class="action-btn ${c.status === 'active' ? 'danger' : ''}" type="button" data-collab-status="${c.id}" data-status="${c.status}">${c.status === 'active' ? 'Desativar' : 'Ativar'}</button></div></td>
      </tr>`;
    }).join('');
  }

  async function createCollaborator(event) {
    event.preventDefault();
    const name = $('collaboratorName').value.trim();
    const email = normalizeEmail($('collaboratorEmail').value);
    const employee = $('collaboratorEmployee').value.trim();
    const department = $('collaboratorDepartment').value.trim();
    if (!name) return;
    const account = email ? [...state.profiles, ...state.customers].find(p => normalizeEmail(p.email) === email) : null;
    const payload = { tenant_id: state.tenantId, name, email: email || null, employee_number: employee || null, department: department || null, user_id: account?.user_id || null, status: 'active' };
    const { error } = await client.from('collaborators').insert(payload);
    if (error) return toast(error.message || 'Não foi possível cadastrar o colaborador.');
    event.target.reset();
    toast('Colaborador cadastrado. Agora você pode associar os equipamentos.');
    await loadData();
  }

  async function editCollaborator(id) {
    const c = state.collaborators.find(x => x.id === id); if (!c) return;
    const name = prompt('Nome do colaborador:', c.name); if (name === null || !name.trim()) return;
    const email = prompt('E-mail (opcional):', c.email || ''); if (email === null) return;
    const employee = prompt('Matrícula (opcional):', c.employee_number || ''); if (employee === null) return;
    const department = prompt('Setor / departamento (opcional):', c.department || ''); if (department === null) return;
    const normalizedEmail = normalizeEmail(email);
    const account = normalizedEmail ? [...state.profiles, ...state.customers].find(p => normalizeEmail(p.email) === normalizedEmail) : null;
    const patch = { name: name.trim(), email: normalizedEmail || null, employee_number: employee.trim() || null, department: department.trim() || null, updated_at: new Date().toISOString() };
    if (!c.user_id && account?.user_id) patch.user_id = account.user_id;
    const { error } = await client.from('collaborators').update(patch).eq('id', id).eq('tenant_id', state.tenantId);
    if (error) return toast(error.message || 'Falha ao editar colaborador.');
    toast('Colaborador atualizado.'); await loadData();
  }

  async function toggleStatus(id, current) {
    const linked = assetsForCollaborator(id).length;
    if (current === 'active' && linked) return toast('Remova ou transfira os equipamentos antes de desativar este colaborador.');
    const next = current === 'active' ? 'inactive' : 'active';
    const { error } = await client.from('collaborators').update({ status: next, updated_at: new Date().toISOString() }).eq('id', id).eq('tenant_id', state.tenantId);
    if (error) return toast(error.message || 'Falha ao alterar status.');
    toast(next === 'active' ? 'Colaborador ativado.' : 'Colaborador desativado.'); await loadData();
  }

  function openAssets(id) {
    const c = state.collaborators.find(x => x.id === id); if (!c) return;
    state.editing = c;
    state.assetDraft = new Map(state.assets.map(a => [a.asset_key, a.collaborator_id === c.id]));
    $('collaboratorAssetsTitle').textContent = `Equipamentos de ${c.name}`;
    $('collaboratorAssetsSubtitle').textContent = 'Marque os ativos desta pessoa. Se um equipamento estiver com outro colaborador, marcá-lo aqui fará a transferência da responsabilidade.';
    $('collaboratorAssetSearch').value = '';
    $('collaboratorAssetsModal').hidden = false;
    renderAssetList();
  }

  function closeAssets() { $('collaboratorAssetsModal').hidden = true; state.editing = null; state.assetDraft.clear(); }

  function renderAssetList() {
    const box = $('collaboratorAssetsList'); if (!box || !state.editing) return;
    const q = String($('collaboratorAssetSearch')?.value || '').trim().toLowerCase();
    const rows = state.assets.filter(a => !q || [a.asset_name,a.equipment_type,a.asset_tag,a.serial_number,a.hostname,a.sector_name,a.collaborator_name].some(v => String(v || '').toLowerCase().includes(q)));
    if (!rows.length) { box.innerHTML = '<div class="collaborator-empty">Nenhum equipamento encontrado neste inventário.</div>'; return; }
    box.innerHTML = rows.map(a => {
      const checked = state.assetDraft.get(a.asset_key) === true;
      const other = a.collaborator_id && a.collaborator_id !== state.editing.id ? a.collaborator_name : null;
      const ident = [a.asset_tag ? `PAT ${a.asset_tag}` : null,a.serial_number ? `SN ${a.serial_number}` : null,a.hostname ? `Host ${a.hostname}` : null].filter(Boolean).join(' · ');
      return `<label class="collaborator-asset-row ${checked ? 'selected' : ''}"><input type="checkbox" data-asset-key="${esc(a.asset_key)}" ${checked ? 'checked' : ''}><span class="collaborator-asset-main"><strong>${esc(a.asset_name || a.equipment_type || 'Equipamento')}</strong><small>${esc([ident,a.sector_name].filter(Boolean).join(' · '))}</small></span><span class="collaborator-owner ${other ? 'other' : checked ? 'mine' : ''}">${other ? `Atual: ${esc(other)}` : checked ? 'Responsável atual' : 'Sem responsável'}</span></label>`;
    }).join('');
  }

  async function saveAssets() {
    if (!state.editing) return;
    const button = $('saveCollaboratorAssets'); button.disabled = true; button.textContent = 'Salvando...';
    try {
      for (const asset of state.assets) {
        const desired = state.assetDraft.get(asset.asset_key) === true;
        const currentlyMine = asset.collaborator_id === state.editing.id;
        if (desired === currentlyMine) continue;
        if (desired) {
          const { error } = await client.rpc('admin_assign_collaborator_asset', { p_tenant_id: state.tenantId, p_collaborator_id: state.editing.id, p_asset_key: asset.asset_key });
          if (error) throw error;
        } else if (currentlyMine) {
          const { error } = await client.rpc('admin_unassign_collaborator_asset', { p_tenant_id: state.tenantId, p_asset_key: asset.asset_key });
          if (error) throw error;
        }
      }
      toast('Associações de equipamentos atualizadas.');
      closeAssets(); await loadData();
    } catch (error) {
      toast(error.message || 'Falha ao salvar associações.');
    } finally {
      button.disabled = false; button.textContent = 'Salvar associações';
    }
  }

  function ensureMemberHeader() {
    const row = document.querySelector('[data-view-panel="users"] table thead tr');
    if (!row || row.querySelector('[data-collaborator-col]')) return;
    const th = document.createElement('th'); th.dataset.collaboratorCol = '1'; th.textContent = 'Colaborador';
    const portal = row.querySelector('[data-support-col="portal"]');
    const cadastro = Array.from(row.children).find(cell => /cadastro/i.test(cell.textContent || ''));
    row.insertBefore(th, portal || cadastro || row.lastElementChild);
  }

  function annotateMembers() {
    ensureMemberHeader();
    document.querySelectorAll('#membersBody tr').forEach(row => {
      const identity = row.querySelector('[data-role-id],[data-status-id]');
      const userId = identity?.dataset.roleId || identity?.dataset.statusId;
      if (!userId) return;
      let cell = row.querySelector('[data-collaborator-cell]');
      if (!cell) {
        cell = document.createElement('td'); cell.dataset.collaboratorCell = '1';
        const portalCell = row.querySelector('[data-support-cell="portal"]');
        const cells = Array.from(row.children);
        const cadastro = cells.find(td => /^\d{2}\//.test((td.textContent || '').trim()));
        row.insertBefore(cell, portalCell || cadastro || row.lastElementChild);
      }
      const collab = collaboratorForUser(userId);
      const profile = state.profiles.find(p => p.user_id === userId);
      cell.innerHTML = collab ? `<button type="button" class="collaborator-member-toggle on" data-open-collaborator="${collab.id}">✓ Colaborador</button>` : `<button type="button" class="collaborator-member-toggle" data-make-collaborator="${userId}">Vincular</button>`;
      if (profile && collab) cell.title = `${profile.name || profile.email} também é colaborador e pode ter equipamentos associados.`;
    });
  }

  async function makeMemberCollaborator(userId) {
    const p = state.profiles.find(x => x.user_id === userId); if (!p) return;
    const { error } = await client.from('collaborators').insert({ tenant_id: state.tenantId, user_id: userId, name: p.name || p.email || 'Colaborador', email: p.email || null, status: 'active' });
    if (error) return toast(error.message || 'Falha ao vincular usuário como colaborador.');
    toast('Usuário marcado como colaborador.'); await loadData();
  }

  function bindDynamic() {
    $('collaboratorForm')?.addEventListener('submit', createCollaborator);
    $('collaboratorSearch')?.addEventListener('input', renderTable);
    $('collaboratorAssetSearch')?.addEventListener('input', renderAssetList);
    $('saveCollaboratorAssets')?.addEventListener('click', saveAssets);
    $('collaboratorAssetsModal')?.addEventListener('click', e => { if (e.target === $('collaboratorAssetsModal') || e.target.closest('[data-collab-close]')) closeAssets(); });
    $('collaboratorAssetsList')?.addEventListener('change', e => {
      const input = e.target.closest('[data-asset-key]'); if (!input) return;
      state.assetDraft.set(input.dataset.assetKey, input.checked); renderAssetList();
    });
    document.addEventListener('click', e => {
      const assets = e.target.closest('[data-collab-assets]'); if (assets) return openAssets(assets.dataset.collabAssets);
      const edit = e.target.closest('[data-collab-edit]'); if (edit) return editCollaborator(edit.dataset.collabEdit);
      const status = e.target.closest('[data-collab-status]'); if (status) return toggleStatus(status.dataset.collabStatus, status.dataset.status);
      const make = e.target.closest('[data-make-collaborator]'); if (make) return makeMemberCollaborator(make.dataset.makeCollaborator);
      const open = e.target.closest('[data-open-collaborator]'); if (open) { switchToCollaborators(); setTimeout(() => openAssets(open.dataset.openCollaborator), 100); }
    });
    $('tenantSelector')?.addEventListener('change', () => setTimeout(() => loadData().catch(console.warn), 180));
  }

  async function boot() {
    ensureNavAndView();
    const body = $('membersBody');
    if (body) new MutationObserver(() => annotateMembers()).observe(body, { childList: true });
    let tries = 0;
    const wait = async () => {
      ensureNavAndView();
      if (selectedTenantId()) return loadData().catch(error => console.warn('RRN collaborators:', error));
      if (tries++ < 40) setTimeout(wait, 150);
    };
    wait();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
