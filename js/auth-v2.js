(() => {
  'use strict';

  const cfg = window.RRN_SUPABASE || {};
  const configured = /^https:\/\/.+\.supabase\.co$/i.test(cfg.url || '')
    && Boolean(cfg.anonKey)
    && !String(cfg.url).includes('SEU-PROJETO')
    && !String(cfg.anonKey).includes('SUA_CHAVE');

  const setMessage = (el, text = '', type = '') => {
    if (!el) return;
    el.textContent = text;
    el.classList.remove('error','success');
    if (type) el.classList.add(type);
  };

  const setBusy = (button, state, text = 'Processando...') => {
    if (!button) return;
    if (!button.dataset.originalText) button.dataset.originalText = button.textContent.trim();
    button.disabled = state;
    button.textContent = state ? text : button.dataset.originalText;
  };

  function switchTab(target) {
    const login = target === 'login';
    document.getElementById('formLogin')?.classList.toggle('active', login);
    document.getElementById('formRegister')?.classList.toggle('active', !login);
    document.getElementById('tabLogin')?.classList.toggle('active', login);
    document.getElementById('tabRegister')?.classList.toggle('active', !login);
    document.getElementById('tabLogin')?.setAttribute('aria-selected', String(login));
    document.getElementById('tabRegister')?.setAttribute('aria-selected', String(!login));
    const title = document.getElementById('authTitle');
    const subtitle = document.getElementById('authSubtitle');
    if (title) title.textContent = login ? 'Acessar workspace' : 'Criar acesso';
    if (subtitle) subtitle.textContent = login
      ? 'Entre com seu e-mail corporativo e senha.'
      : 'Crie uma organização ou ingresse usando um convite.';
  }

  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.target));
  });

  document.querySelectorAll('[data-toggle-password]').forEach(button => {
    button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.togglePassword);
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
      button.textContent = input.type === 'password' ? 'Mostrar' : 'Ocultar';
    });
  });

  const requestedMode = new URLSearchParams(location.search).get('mode');
  if (requestedMode === 'register') switchTab('register');

  if (!configured || !window.supabase?.createClient) {
    const notice = document.getElementById('backendNotice');
    if (notice) {
      notice.hidden = false;
      notice.textContent = window.RRN_PREVIEW_DEMO
        ? 'Preview completo ativo: use o botão de demonstração para acessar todas as telas. Login e cadastro reais aguardam a conexão com o Supabase.'
        : 'O backend ainda não foi configurado. Preencha js/supabase-config.js antes de usar login e cadastro reais.';
    }
    document.getElementById('loginButton')?.setAttribute('disabled','disabled');
    document.getElementById('registerButton')?.setAttribute('disabled','disabled');
    return;
  }

  const client = window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  async function getProfile(userId) {
    const { data, error } = await client
      .from('profiles')
      .select('user_id,tenant_id,name,email,role,status,tenants(name,slug)')
      .eq('user_id', userId)
      .single();
    if (error) throw error;
    if (!data || data.status !== 'active') throw new Error('Seu acesso está inativo.');
    return data;
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
  }

  document.getElementById('formLogin')?.addEventListener('submit', async event => {
    event.preventDefault();
    const msg = document.getElementById('loginMsg');
    const button = document.getElementById('loginButton');
    const email = document.getElementById('loginEmail')?.value.trim().toLowerCase();
    const password = document.getElementById('loginSenha')?.value || '';

    if (!email || !password) return setMessage(msg, 'Informe e-mail e senha.', 'error');
    setBusy(button, true, 'Autenticando...');

    try {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const profile = await getProfile(data.user.id);
      saveCompat(profile);
      sessionStorage.removeItem('rrn_hydrated_tenant');
      location.replace('dashboard.html');
    } catch (error) {
      setMessage(msg, /Invalid login credentials/i.test(error.message || '')
        ? 'E-mail ou senha inválidos.'
        : (error.message || 'Não foi possível entrar.'), 'error');
    } finally {
      setBusy(button, false);
    }
  });

  document.getElementById('formRegister')?.addEventListener('submit', async event => {
    event.preventDefault();
    const msg = document.getElementById('registerMsg');
    const button = document.getElementById('registerButton');
    const name = document.getElementById('registerName')?.value.trim();
    const email = document.getElementById('registerEmail')?.value.trim().toLowerCase();
    const password = document.getElementById('registerPassword')?.value || '';
    const organization = document.getElementById('registerOrganization')?.value.trim();
    const invite = document.getElementById('registerInvite')?.value.trim();
    const accepted = document.getElementById('acceptTerms')?.checked;

    if (!name || !email || password.length < 8) return setMessage(msg, 'Preencha nome, e-mail e uma senha com pelo menos 8 caracteres.', 'error');
    if (!organization && !invite) return setMessage(msg, 'Informe a organização ou um código de convite.', 'error');
    if (!accepted) return setMessage(msg, 'Confirme que você está autorizado a criar ou ingressar no workspace.', 'error');

    setBusy(button, true, 'Criando acesso...');
    try {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { data: { name, organization_name: organization || '', invite_code: invite || '' } }
      });
      if (error) throw error;

      if (data.session?.user) {
        const profile = await getProfile(data.session.user.id);
        saveCompat(profile);
        location.replace('dashboard.html');
        return;
      }

      document.getElementById('formRegister')?.reset();
      setMessage(msg, 'Cadastro criado. Confirme seu e-mail e depois faça login.', 'success');
      switchTab('login');
    } catch (error) {
      setMessage(msg, error.message || 'Não foi possível criar o acesso.', 'error');
    } finally {
      setBusy(button, false);
    }
  });

  client.auth.getSession().then(async ({ data }) => {
    if (!data.session?.user) return;
    try {
      const profile = await getProfile(data.session.user.id);
      saveCompat(profile);
      location.replace('dashboard.html');
    } catch (error) {
      console.warn(error);
    }
  });
})();
