(() => {
  'use strict';
  if (window.__RRN_ADMIN_USER_CREATE_V2__) return;
  window.__RRN_ADMIN_USER_CREATE_V2__ = true;

  const cfg = window.RRN_SUPABASE || {};
  if (!window.supabase?.createClient || !cfg.url || !cfg.anonKey) return;
  const client = window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  let platformAdmin = false;
  let tenants = [];

  function toast(text) {
    const el = $('toast');
    if (!el) return;
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { el.hidden = true; }, 3400);
  }

  function injectStyles() {
    if (document.getElementById('rrnAdminUserCreateStyle')) return;
    const style = document.createElement('style');
    style.id = 'rrnAdminUserCreateStyle';
    style.textContent = `
      .rrn-user-create-panel{margin-bottom:18px}
      .rrn-user-create-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
      .rrn-user-create-grid .field.full{grid-column:1/-1}
      .rrn-user-create-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:14px}
      .rrn-user-credentials{margin-top:14px;padding:14px;border:1px solid var(--rrn-border,#d9e1e5);border-radius:12px;background:var(--rrn-surface-soft,#f5f8f8)}
      .rrn-user-credentials strong,.rrn-user-credentials code{display:block;margin-top:5px;word-break:break-all}
      .rrn-user-credentials code{padding:9px 10px;border-radius:8px;background:rgba(22,58,77,.08);font-weight:800}
      @media(max-width:720px){.rrn-user-create-grid{grid-template-columns:1fr}.rrn-user-create-grid .field.full{grid-column:auto}}
    `;
    document.head.appendChild(style);
  }

  async function loadContext() {
    const { data: { session } } = await client.auth.getSession();
    if (!session?.user) return null;
    const [{ data: isPlatform }, { data: profile }] = await Promise.all([
      client.rpc('is_platform_admin'),
      client.from('profiles').select('tenant_id,role,status').eq('user_id', session.user.id).maybeSingle()
    ]);
    if (!profile || profile.status !== 'active' || profile.role !== 'admin') return null;
    platformAdmin = !!isPlatform;
    let q = client.from('tenants').select('id,name,slug,status').eq('status','active').order('name');
    if (!platformAdmin) q = q.eq('id', profile.tenant_id);
    const { data, error } = await q;
    if (error) throw error;
    tenants = data || [];
    return profile;
  }

  function tenantOptions() {
    const current = $('tenantSelector')?.value;
    return tenants.map(t => `<option value="${esc(t.id)}" ${t.id===current?'selected':''}>${esc(t.name)}</option>`).join('');
  }

  function mount() {
    const view = document.querySelector('[data-view-panel="users"]');
    if (!view || $('rrnUserCreatePanel')) return;
    const firstPanel = view.querySelector('.panel');
    const panel = document.createElement('div');
    panel.id = 'rrnUserCreatePanel';
    panel.className = 'panel rrn-user-create-panel';
    panel.innerHTML = `
      <div class="panel-heading">
        <span class="eyebrow">Novo acesso</span>
        <h2>Criar usuário vinculado à empresa</h2>
        <p>O login será criado no Supabase e ficará isolado no tenant da empresa selecionada.</p>
      </div>
      <form id="rrnUserCreateForm">
        <div class="rrn-user-create-grid">
          <label class="field"><span>Empresa</span><select id="rrnUserTenant" ${platformAdmin?'':'disabled'}>${tenantOptions()}</select></label>
          <label class="field"><span>Perfil</span><select id="rrnUserRole"><option value="operador">Operador</option><option value="monitoramento">Monitoramento</option><option value="admin">Administrador da empresa</option></select></label>
          <label class="field"><span>Nome completo</span><input id="rrnUserName" autocomplete="off" required></label>
          <label class="field"><span>E-mail</span><input id="rrnUserEmail" type="email" autocomplete="off" required></label>
          <label class="field full"><span>Senha inicial (opcional)</span><input id="rrnUserPassword" type="text" minlength="8" placeholder="Deixe em branco para gerar uma senha temporária automaticamente" autocomplete="off"></label>
        </div>
        <div class="rrn-user-create-actions">
          <button type="submit" class="btn-primary" id="rrnCreateUserButton">Criar usuário</button>
          <small>Se a senha ficar vazia, ela será exibida apenas uma vez após a criação.</small>
        </div>
      </form>
      <div class="rrn-user-credentials" id="rrnUserCredentials" hidden>
        <span>Usuário criado com sucesso</span>
        <strong id="rrnCreatedUser"></strong>
        <div id="rrnGeneratedPasswordWrap" hidden><small>Senha temporária</small><code id="rrnGeneratedPassword"></code><button type="button" class="btn-secondary" id="rrnCopyCredentials" style="margin-top:10px">Copiar acesso</button></div>
      </div>`;
    if (firstPanel) view.insertBefore(panel, firstPanel); else view.appendChild(panel);

    $('rrnUserCreateForm').addEventListener('submit', createUser);
    $('rrnCopyCredentials')?.addEventListener('click', copyCredentials);
    $('tenantSelector')?.addEventListener('change', () => {
      const select = $('rrnUserTenant');
      if (select && Array.from(select.options).some(o => o.value === $('tenantSelector').value)) select.value = $('tenantSelector').value;
    });
  }

  async function createUser(event) {
    event.preventDefault();
    const button = $('rrnCreateUserButton');
    const tenantId = $('rrnUserTenant')?.value || $('tenantSelector')?.value;
    const payload = {
      action: 'create_tenant_user',
      tenant_id: tenantId,
      name: $('rrnUserName').value.trim(),
      email: $('rrnUserEmail').value.trim().toLowerCase(),
      role: $('rrnUserRole').value,
      password: $('rrnUserPassword').value.trim()
    };
    if (!payload.tenant_id || !payload.name || !payload.email) return toast('Preencha empresa, nome e e-mail.');
    button.disabled = true;
    button.textContent = 'Criando...';
    try {
      const { data, error } = await client.functions.invoke('tenant-admin', { body: payload });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'Não foi possível criar o usuário.');
      $('rrnCreatedUser').textContent = `${data.user.name} · ${data.user.email} · ${data.user.tenant_name}`;
      $('rrnUserCredentials').hidden = false;
      const temp = data.temporary_password || '';
      $('rrnGeneratedPasswordWrap').hidden = !temp;
      $('rrnGeneratedPassword').textContent = temp;
      event.target.reset();
      const tenantSelect = $('rrnUserTenant');
      if (tenantSelect && Array.from(tenantSelect.options).some(o => o.value === tenantId)) tenantSelect.value = tenantId;
      toast('Usuário criado e vinculado à empresa.');
      if ($('tenantSelector')?.value === tenantId) $('tenantSelector').dispatchEvent(new Event('change', { bubbles: true }));
    } catch (error) {
      console.error('RRN create user:', error);
      toast(error?.message || 'Falha ao criar usuário.');
    } finally {
      button.disabled = false;
      button.textContent = 'Criar usuário';
    }
  }

  async function copyCredentials() {
    const email = $('rrnCreatedUser')?.textContent?.split(' · ')[1] || '';
    const password = $('rrnGeneratedPassword')?.textContent || '';
    const text = `RRN Manager\nE-mail: ${email}\nSenha temporária: ${password}`;
    try { await navigator.clipboard.writeText(text); toast('Acesso copiado.'); }
    catch { prompt('Copie o acesso:', text); }
  }

  async function boot() {
    try {
      injectStyles();
      const profile = await loadContext();
      if (!profile) return;
      mount();
    } catch (error) {
      console.warn('RRN admin user create:', error);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
