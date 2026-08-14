(() => {
  'use strict';

  const cfg = window.RRN_SUPABASE || {};
  const configured = /^https:\/\/.+\.supabase\.co$/i.test(cfg.url || '')
    && Boolean(cfg.anonKey)
    && !String(cfg.url).includes('SEU-PROJETO')
    && !String(cfg.anonKey).includes('SUA_CHAVE');

  // O runtime multi-tenant só pode assumir a navegação quando existe um
  // Supabase real configurado. Em preview/fallback local, preview-demo.js
  // mantém a sessão local e este módulo deve permanecer totalmente inativo.
  if (window.RRN_PREVIEW_DEMO || !configured || !window.supabase?.createClient) return;

  const client = window.RRN_SUPABASE_CLIENT || window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  window.RRN_SUPABASE_CLIENT = client;

  const syncKeys = new Set(['setores','chamados','asset_history','asset_trash']);
  const legacyCredentialKeys = ['usuarios','users','rememberedUser','rememberedPass','loggedUser'];
  let profile = null;
  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;
  let syncTimer = null;
  let idleTimer = null;
  let lastActivityAt = Date.now();
  let idleGuardInstalled = false;

  function addStyle() {
    if (document.querySelector('link[data-rrn-enterprise]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/style/enterprise.css';
    link.dataset.rrnEnterprise = '1';
    document.head.appendChild(link);
  }

  function purgeLegacyCredentials() {
    legacyCredentialKeys.forEach(key => {
      originalRemoveItem.call(localStorage, key);
      originalRemoveItem.call(sessionStorage, key);
    });

    const staleUserKeys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && /^user_/i.test(key)) staleUserKeys.push(key);
    }
    staleUserKeys.forEach(key => originalRemoveItem.call(localStorage, key));
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
    const payload = { version: 2 };
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
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  }

  function setDisplay(selector, visible, display = '') {
    document.querySelectorAll(selector).forEach(element => {
      element.style.display = visible ? display : 'none';
    });
  }

  function enforceRoleUi() {
    const role = profile?.role || 'monitoramento';
    document.body.dataset.rrnRole = role;

    const canOperate = role === 'admin' || role === 'operador';
    const isAdmin = role === 'admin';

    setDisplay('#addSetorBtn', canOperate, 'inline-block');
    setDisplay('.operador-only', canOperate, '');
    setDisplay('.admin-only', isAdmin, '');
    setDisplay('#adminMenu', isAdmin, 'block');

    const deleteAll = document.querySelector('.excluir-tudo-btn');
    if (deleteAll) deleteAll.style.display = isAdmin ? '' : 'none';

    if (role === 'monitoramento') {
      ['addSetor','confirmarAddSetor','confirmarAddMaquina','saveObservation','markForMaintenance','releaseMachine','confirmarTransferencia']
        .forEach(name => {
          if (typeof window[name] === 'function') window[name] = () => undefined;
        });
    }
  }

  function enhanceUi() {
    const userName = document.getElementById('userName');
    if (userName) userName.textContent = profile.name || profile.email || 'Usuário';
    if (userName && !document.querySelector('.rrn-tenant-pill')) {
      const pill = document.createElement('span');
      pill.className = 'rrn-tenant-pill';
      userName.after(pill);
    }

    const pill = document.querySelector('.rrn-tenant-pill');
    if (pill) pill.textContent = profile.tenants?.name || 'Workspace';

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
      if (left) {
        let card = left.querySelector('.rrn-workspace-card');
        if (!card) {
          card = document.createElement('div');
          card.className = 'rrn-workspace-card';
          left.appendChild(card);
        }
        card.innerHTML = `<span>Workspace ativo</span><strong>${escapeHtml(profile.tenants?.name || 'Workspace')}</strong><small>${escapeHtml(profile.role)} · dados isolados por tenant</small>`;
      }
      const save = document.querySelector('.save-btn');
      if (save && save.parentElement !== modal) modal.appendChild(save);
      if (save) save.textContent = 'Concluir';
    }

    window.RRN_UI?.updateOverview?.();
    enforceRoleUi();
    setTimeout(enforceRoleUi, 250);
  }

  function clearLocalSessionState() {
    clearTimeout(idleTimer);
    for (const key of syncKeys) originalRemoveItem.call(localStorage, key);
    originalRemoveItem.call(localStorage, 'usuarioLogado');
    purgeLegacyCredentials();
    sessionStorage.removeItem('rrn_hydrated_tenant');
  }

  async function secureLogout() {
    try { await pushState(); } catch {}
    try { await client.auth.signOut({ scope: 'local' }); } catch {}
    clearLocalSessionState();
    location.replace('index.html');
  }

  async function signOutOtherSessions() {
    const { error } = await client.auth.signOut({ scope: 'others' });
    if (error) throw error;
    return true;
  }

  async function signOutAllSessions() {
    try { await pushState(); } catch {}
    const { error } = await client.auth.signOut({ scope: 'global' });
    if (error) throw error;
    clearLocalSessionState();
    location.replace('/login.html');
    return true;
  }

  function idleStorageKey() {
    return `rrn_idle_timeout_minutes_${profile?.user_id || 'user'}`;
  }

  function getIdleMinutes() {
    const raw = localStorage.getItem(idleStorageKey());
    if (raw == null || raw === '') return 120;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : 120;
  }

  function scheduleIdleLogout() {
    clearTimeout(idleTimer);
    const minutes = getIdleMinutes();
    if (!minutes) return;
    const timeoutMs = minutes * 60 * 1000;
    const remaining = timeoutMs - (Date.now() - lastActivityAt);
    if (remaining <= 0) {
      sessionStorage.setItem('rrn_logout_reason', 'idle');
      secureLogout().catch(console.warn);
      return;
    }
    idleTimer = setTimeout(() => {
      sessionStorage.setItem('rrn_logout_reason', 'idle');
      secureLogout().catch(console.warn);
    }, remaining);
  }

  function markActivity() {
    lastActivityAt = Date.now();
    scheduleIdleLogout();
  }

  function setIdleMinutes(value) {
    const minutes = Number(value);
    if (!Number.isFinite(minutes) || minutes < 0) throw new Error('Tempo de inatividade inválido.');
    originalSetItem.call(localStorage, idleStorageKey(), String(minutes));
    lastActivityAt = Date.now();
    scheduleIdleLogout();
    window.dispatchEvent(new CustomEvent('rrn:idle-timeout-updated', { detail: { minutes } }));
    return minutes;
  }

  function installIdleGuard() {
    if (idleGuardInstalled) return;
    idleGuardInstalled = true;
    const options = { passive: true, capture: true };
    window.addEventListener('pointerdown', markActivity, options);
    window.addEventListener('touchstart', markActivity, options);
    window.addEventListener('keydown', markActivity, { capture: true });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') markActivity();
    });
    scheduleIdleLogout();
  }

  async function boot() {
    addStyle();
    purgeLegacyCredentials();

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
      name: profile.name || profile.email || 'Usuário',
      userName: profile.name || profile.email || 'Usuário',
      email: profile.email || '',
      tenantId: profile.tenant_id,
      tenantName: profile.tenants?.name || 'Workspace',
      role: profile.role
    });

    window.RRN_SECURE_LOGOUT = secureLogout;
    window.RRN_SESSION_SECURITY = Object.freeze({
      signOutOthers: signOutOtherSessions,
      signOutAll: signOutAllSessions,
      getIdleMinutes,
      setIdleMinutes
    });
    installIdleGuard();
    window.dispatchEvent(new CustomEvent('rrn:session-ready', { detail: window.RRN_SESSION }));

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