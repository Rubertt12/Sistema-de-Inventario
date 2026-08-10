(() => {
  'use strict';

  const cfg = window.RRN_SUPABASE || {};
  if (!window.supabase?.createClient || !/^https:\/\/.+\.supabase\.co$/i.test(cfg.url || '')) return;

  const client = window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const syncKeys = new Set(['setores','chamados']);
  let profile = null;
  let originalSetItem = Storage.prototype.setItem;
  let originalRemoveItem = Storage.prototype.removeItem;
  let syncTimer = null;

  function addStyle() {
    if (document.querySelector('link[data-rrn-enterprise]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/style/enterprise.css';
    link.dataset.rrnEnterprise = '1';
    document.head.appendChild(link);
  }

  async function getProfile(userId) {
    const { data, error } = await client
      .from('profiles')
      .select('user_id,tenant_id,name,email,role,status,tenants(name,slug)')
      .eq('user_id', userId)
      .single();
    if (error) throw error;
    if (!data || data.status !== 'active') throw new Error('Acesso inativo.');
    return data;
  }

  function saveCompat(p) {
    const compat = {
      id: p.user_id,
      nome: p.name || p.email || 'Usuário',
      email: p.email || '',
      perfil: p.role || 'monitoramento',
      tenant_id: p.tenant_id,
      tenant: p.tenants?.name || 'Workspace'
    };
    originalSetItem.call(localStorage, 'usuarioLogado', JSON.stringify(compat));
    return compat;
  }

  function getPayload() {
    const payload = { version: 1 };
    for (const key of syncKeys) {
      const raw = localStorage.getItem(key);
      if (raw == null) continue;
      try { payload[key] = JSON.parse(raw); }
      catch { payload[key] = raw; }
    }
    return payload;
  }

  async function pushState() {
    if (!profile || profile.role === 'monitoramento') return;
    const { error } = await client.from('tenant_inventory_state').upsert({
      tenant_id: profile.tenant_id,
      payload: getPayload(),
      updated_by: profile.user_id,
      updated_at: new Date().toISOString()
    }, { onConflict: 'tenant_id' });
    if (error) console.warn('Falha ao sincronizar inventário:', error.message);
  }

  function patchStorage() {
    Storage.prototype.setItem = function(key, value) {
      originalSetItem.call(this, key, value);
      if (this === localStorage && syncKeys.has(String(key))) {
        clearTimeout(syncTimer);
        syncTimer = setTimeout(() => pushState().catch(console.warn), 650);
      }
    };
    Storage.prototype.removeItem = function(key) {
      originalRemoveItem.call(this, key);
      if (this === localStorage && syncKeys.has(String(key))) {
        clearTimeout(syncTimer);
        syncTimer = setTimeout(() => pushState().catch(console.warn), 650);
      }
    };
  }

  async function hydrate() {
    const { data, error } = await client
      .from('tenant_inventory_state')
      .select('payload')
      .eq('tenant_id', profile.tenant_id)
      .maybeSingle();
    if (error) throw error;

    const payload = data?.payload || {};
    let changed = false;
    for (const key of syncKeys) {
      if (!(key in payload)) continue;
      const next = typeof payload[key] === 'string' ? payload[key] : JSON.stringify(payload[key]);
      if (localStorage.getItem(key) !== next) {
        originalSetItem.call(localStorage, key, next);
        changed = true;
      }
    }

    const marker = sessionStorage.getItem('rrn_hydrated_tenant');
    sessionStorage.setItem('rrn_hydrated_tenant', profile.tenant_id);
    if (changed && marker !== profile.tenant_id) {
      location.reload();
      return true;
    }
    return false;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function enhanceUi() {
    const userName = document.getElementById('userName');
    if (userName) userName.textContent = profile.name || profile.email || 'Usuário';
    if (userName && !document.querySelector('.rrn-tenant-pill')) {
      const pill = document.createElement('span');
      pill.className = 'rrn-tenant-pill';
      pill.textContent = profile.tenants?.name || 'Workspace';
      userName.after(pill);
    }

    const modal = document.getElementById('configModal');
    if (modal) {
      modal.classList.add('rrn-settings');
      const title = modal.querySelector('.modal-title');
      if (title && !modal.querySelector('.rrn-settings-subtitle')) {
        const subtitle = document.createElement('p');
        subtitle.className = 'rrn-settings-subtitle';
        subtitle.textContent = 'Preferências do usuário, aparência e portabilidade de dados.';
        title.after(subtitle);
      }
      const left = modal.querySelector('.modal-left');
      if (left && !left.querySelector('.rrn-workspace-card')) {
        const card = document.createElement('div');
        card.className = 'rrn-workspace-card';
        card.innerHTML = `<span>Workspace ativo</span><strong>${escapeHtml(profile.tenants?.name || 'Workspace')}</strong><small>${escapeHtml(profile.role)} · dados isolados por tenant</small>`;
        left.appendChild(card);
      }
      const save = document.querySelector('.save-btn');
      if (save && save.parentElement !== modal) modal.appendChild(save);
      if (save) save.textContent = 'Concluir';
    }
  }

  async function secureLogout() {
    try { await pushState(); } catch {}
    try { await client.auth.signOut(); } catch {}
    for (const key of syncKeys) originalRemoveItem.call(localStorage, key);
    originalRemoveItem.call(localStorage, 'usuarioLogado');
    sessionStorage.removeItem('rrn_hydrated_tenant');
    location.replace('index.html');
  }

  async function boot() {
    addStyle();
    const { data: { session } } = await client.auth.getSession();
    if (!session?.user) {
      originalRemoveItem.call(localStorage, 'usuarioLogado');
      location.replace('index.html');
      return;
    }

    profile = await getProfile(session.user.id);
    patchStorage();
    saveCompat(profile);
    window.RRN_SESSION = Object.freeze({
      userId: profile.user_id,
      tenantId: profile.tenant_id,
      tenantName: profile.tenants?.name || 'Workspace',
      role: profile.role
    });

    if (await hydrate()) return;
    const finish = () => {
      enhanceUi();
      window.logout = secureLogout;
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(finish), { once:true });
    else setTimeout(finish);
  }

  boot().catch(error => {
    console.error('Falha no runtime multi-tenant:', error);
    originalRemoveItem.call(localStorage, 'usuarioLogado');
    location.replace('index.html');
  });
})();
