(() => {
  'use strict';
  if (window.__RRN_TENANT_LOGIN_CONTEXT__) return;
  window.__RRN_TENANT_LOGIN_CONTEXT__ = true;

  const params = new URLSearchParams(location.search);
  const requestedSlug = (params.get('org') || '').trim().toLowerCase();
  if (!requestedSlug || !document.getElementById('formLogin')) {
    window.RRN_TENANT_LOGIN_READY = Promise.resolve();
    return;
  }

  const cfg = window.RRN_SUPABASE || {};
  const client = window.RRN_SUPABASE_CLIENT || window.supabase?.createClient?.(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  if (client) window.RRN_SUPABASE_CLIENT = client;

  const normalize = value => String(value || '').trim().toLowerCase();
  let targetTenant = null;
  let portalValid = false;

  function setMessage(text = '', type = '') {
    const msg = document.getElementById('loginMsg');
    if (!msg) return;
    msg.textContent = text;
    msg.classList.remove('error', 'success');
    if (type) msg.classList.add(type);
  }

  function setBusy(button, state) {
    if (!button) return;
    button.dataset.portalOriginalText ||= button.textContent.trim();
    button.disabled = state;
    button.textContent = state ? 'Autenticando...' : button.dataset.portalOriginalText;
  }

  function ensureStyles() {
    if (document.getElementById('rrnTenantPortalStyles')) return;
    const style = document.createElement('style');
    style.id = 'rrnTenantPortalStyles';
    style.textContent = `
      .rrn-tenant-portal{display:flex;align-items:center;gap:11px;margin:0 0 18px;padding:11px 12px;border:1px solid var(--rrn-border,rgba(22,58,77,.18));border-radius:12px;background:color-mix(in srgb,var(--rrn-secondary,#2F7D78) 9%,var(--rrn-surface,#fff));color:var(--rrn-text,#263238)}
      .rrn-tenant-portal-logo{width:38px;height:38px;object-fit:contain;border-radius:9px;background:#fff;padding:4px;border:1px solid var(--rrn-border,rgba(22,58,77,.18))}
      .rrn-tenant-portal-copy{min-width:0;display:flex;flex-direction:column;gap:2px}.rrn-tenant-portal-copy small{color:var(--rrn-muted,#66757F)!important;font-size:.76rem}.rrn-tenant-portal-copy strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--rrn-heading,#163A4D)!important;font-size:.96rem}
      .rrn-tenant-portal-copy code{color:var(--rrn-muted,#66757F);font:600 .72rem/1.3 ui-monospace,SFMono-Regular,Consolas,monospace}
      .rrn-tenant-invalid{border-color:color-mix(in srgb,var(--rrn-danger,#B9473A) 35%,transparent);background:color-mix(in srgb,var(--rrn-danger,#B9473A) 9%,var(--rrn-surface,#fff))}
      .rrn-tenant-generic-link{display:inline-flex;margin-top:7px;color:var(--rrn-secondary,#2F7D78)!important;font-size:.78rem;font-weight:700;text-decoration:none}.rrn-tenant-generic-link:hover{text-decoration:underline}
    `;
    document.head.appendChild(style);
  }

  function renderPortal(tenant, invalid = false) {
    ensureStyles();
    document.getElementById('rrnTenantPortal')?.remove();
    const header = document.querySelector('.auth-header');
    if (!header) return;
    const box = document.createElement('div');
    box.id = 'rrnTenantPortal';
    box.className = `rrn-tenant-portal${invalid ? ' rrn-tenant-invalid' : ''}`;
    const name = tenant?.tenant_name || 'Ambiente não encontrado';
    const logo = tenant?.logo_url || '/img/icon-png.png';
    box.innerHTML = `<img class="rrn-tenant-portal-logo" src="${logo}" alt=""><div class="rrn-tenant-portal-copy"><small>${invalid ? 'Portal indisponível' : 'Portal da empresa'}</small><strong>${name}</strong><code>${requestedSlug}</code>${invalid ? '<a class="rrn-tenant-generic-link" href="/login.html">Ir para o acesso geral</a>' : ''}</div>`;
    header.insertAdjacentElement('afterend', box);
    if (!invalid) {
      const title = document.getElementById('authTitle');
      const subtitle = document.getElementById('authSubtitle');
      if (title) title.textContent = `Acessar ${name}`;
      if (subtitle) subtitle.textContent = 'Use uma conta vinculada a esta empresa para continuar.';
      document.title = `${name} | RRN Manager`;
    }
  }

  async function getProfile(userId) {
    const { data, error } = await client.from('profiles')
      .select('user_id,tenant_id,name,email,role,status,tenants(name,slug,status)')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Perfil de acesso não encontrado.');
    if (data.status !== 'active') throw new Error('Seu acesso está inativo.');
    return data;
  }

  function profileMatches(profile) {
    return normalize(profile?.tenants?.slug) === requestedSlug && profile?.tenants?.status !== 'inactive';
  }

  function saveCompat(profile) {
    localStorage.setItem('usuarioLogado', JSON.stringify({
      id: profile.user_id,
      nome: profile.name || profile.email || 'Usuário',
      email: profile.email || '',
      perfil: profile.role || 'monitoramento',
      tenant_id: profile.tenant_id,
      tenant: profile.tenants?.name || 'Workspace'
    }));
    sessionStorage.setItem('rrn_login_tenant_slug', requestedSlug);
  }

  async function resolvePortal() {
    if (!client) throw new Error('Serviço de autenticação indisponível.');
    const { data, error } = await client.rpc('get_public_tenant_branding', { p_slug: requestedSlug });
    if (error) throw error;
    targetTenant = Array.isArray(data) ? data[0] : data;
    portalValid = Boolean(targetTenant?.tenant_slug);
    renderPortal(targetTenant, !portalValid);

    const loginButton = document.getElementById('loginButton');
    const registerButton = document.getElementById('registerButton');
    if (!portalValid) {
      loginButton?.setAttribute('disabled', 'disabled');
      registerButton?.setAttribute('disabled', 'disabled');
      setMessage('Esta empresa não existe ou está inativa. Confira o endereço do portal.', 'error');
      return;
    }

    const { data: sessionData } = await client.auth.getSession();
    if (sessionData?.session?.user) {
      try {
        const profile = await getProfile(sessionData.session.user.id);
        if (!profileMatches(profile)) await client.auth.signOut();
      } catch {
        await client.auth.signOut().catch(() => undefined);
      }
    }
  }

  function bindTenantLogin() {
    const form = document.getElementById('formLogin');
    if (!form || form.dataset.rrnTenantBound === '1') return;
    form.dataset.rrnTenantBound = '1';
    form.addEventListener('submit', async event => {
      if (!requestedSlug) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!portalValid) return setMessage('Portal da empresa indisponível.', 'error');
      const email = document.getElementById('loginEmail')?.value.trim().toLowerCase();
      const password = document.getElementById('loginSenha')?.value || '';
      const button = document.getElementById('loginButton');
      if (!email || !password) return setMessage('Informe e-mail e senha.', 'error');
      setMessage();
      setBusy(button, true);
      try {
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const profile = await getProfile(data.user.id);
        if (!profileMatches(profile)) {
          const targetName = targetTenant?.tenant_name || requestedSlug;
          const actualName = profile?.tenants?.name || 'outra empresa';
          await client.auth.signOut().catch(() => undefined);
          throw new Error(`Esta conta pertence a ${actualName} e não ao ambiente ${targetName}.`);
        }
        saveCompat(profile);
        sessionStorage.removeItem('rrn_hydrated_tenant');
        location.replace('dashboard.html');
      } catch (error) {
        const message = String(error?.message || '');
        setMessage(/Invalid login credentials/i.test(message) ? 'E-mail ou senha inválidos.' : (message || 'Não foi possível entrar.'), 'error');
      } finally { setBusy(button, false); }
    }, true);
  }

  window.RRN_TENANT_LOGIN_READY = (async () => {
    try {
      await resolvePortal();
      bindTenantLogin();
      window.RRN_TENANT_PORTAL = { slug: requestedSlug, tenant: targetTenant, valid: portalValid };
    } catch (error) {
      console.warn('RRN tenant portal:', error);
      portalValid = false;
      renderPortal(null, true);
      document.getElementById('loginButton')?.setAttribute('disabled', 'disabled');
      setMessage('Não foi possível validar o portal desta empresa.', 'error');
    }
  })();
})();