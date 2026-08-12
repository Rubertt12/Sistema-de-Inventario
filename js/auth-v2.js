(() => {
  'use strict';

  const cfg = window.RRN_SUPABASE || {};
  const configured = /^https:\/\/.+\.supabase\.co$/i.test(cfg.url || '')
    && Boolean(cfg.anonKey)
    && !String(cfg.url).includes('SEU-PROJETO')
    && !String(cfg.anonKey).includes('SUA_CHAVE');

  const authRedirectUrl = `${location.origin}/login.html`;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const params = new URLSearchParams(location.search);
  const recoveryHint = params.get('type') === 'recovery' || /(?:^|[&#])type=recovery(?:&|$)/i.test(location.hash);
  let recoveryActive = recoveryHint;

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

  function injectRecoveryUI() {
    if (document.getElementById('forgotPasswordButton')) return;
    const loginPasswordField = document.getElementById('loginSenha')?.closest('.field');
    const forgot = document.createElement('button');
    forgot.type = 'button';
    forgot.id = 'forgotPasswordButton';
    forgot.className = 'rrn-auth-link';
    forgot.textContent = 'Esqueci minha senha';
    loginPasswordField?.insertAdjacentElement('afterend', forgot);

    const registerForm = document.getElementById('formRegister');
    registerForm?.insertAdjacentHTML('afterend', `
      <form id="formForgotPassword" class="auth-form" novalidate>
        <div class="rrn-auth-back"><button type="button" data-auth-back>Voltar para o login</button></div>
        <label class="field"><span>E-mail</span><input type="email" id="forgotEmail" placeholder="nome@empresa.com" autocomplete="email" required><small>Enviaremos um link seguro para você definir uma nova senha.</small></label>
        <button type="submit" class="btn-primary" id="forgotPasswordSubmit"><span>Enviar link de recuperação</span></button>
        <p class="form-message" id="forgotPasswordMsg" role="status"></p>
      </form>
      <form id="formResetPassword" class="auth-form" novalidate>
        <label class="field"><span>Nova senha</span><div class="password-field"><input type="password" id="resetPassword" placeholder="Mínimo de 8 caracteres" autocomplete="new-password" minlength="8" required><button type="button" class="password-toggle" data-toggle-password="resetPassword">Mostrar</button></div></label>
        <label class="field"><span>Confirmar nova senha</span><div class="password-field"><input type="password" id="resetPasswordConfirm" placeholder="Repita a nova senha" autocomplete="new-password" minlength="8" required><button type="button" class="password-toggle" data-toggle-password="resetPasswordConfirm">Mostrar</button></div></label>
        <button type="submit" class="btn-primary" id="resetPasswordButton"><span>Definir nova senha</span></button>
        <p class="form-message" id="resetPasswordMsg" role="status"></p>
      </form>`);

    const style = document.createElement('style');
    style.id = 'rrnAuthRecoveryStyles';
    style.textContent = `
      .rrn-auth-link{align-self:flex-end;margin:-7px 0 3px;padding:3px 0;border:0;background:transparent;color:var(--rrn-secondary,#2F7D78);font:inherit;font-size:.78rem;font-weight:700;cursor:pointer}.rrn-auth-link:hover{text-decoration:underline}
      .rrn-auth-back{margin:-4px 0 8px}.rrn-auth-back button{padding:0;border:0;background:transparent;color:var(--rrn-secondary,#2F7D78);font:inherit;font-size:.78rem;font-weight:700;cursor:pointer}.rrn-auth-back button:hover{text-decoration:underline}
    `;
    document.head.appendChild(style);
  }

  function setHeader(title, subtitle) {
    const titleEl = document.getElementById('authTitle');
    const subtitleEl = document.getElementById('authSubtitle');
    if (titleEl) titleEl.textContent = title;
    if (subtitleEl) subtitleEl.textContent = subtitle;
  }

  function hideAllForms() {
    ['formLogin','formRegister','formForgotPassword','formResetPassword'].forEach(id => document.getElementById(id)?.classList.remove('active'));
  }

  function showTabs(show = true) {
    const tabs = document.querySelector('.auth-tabs');
    if (tabs) tabs.hidden = !show;
  }

  function switchTab(target) {
    recoveryActive = false;
    const login = target === 'login';
    hideAllForms();
    document.getElementById(login ? 'formLogin' : 'formRegister')?.classList.add('active');
    showTabs(true);
    document.getElementById('tabLogin')?.classList.toggle('active', login);
    document.getElementById('tabRegister')?.classList.toggle('active', !login);
    document.getElementById('tabLogin')?.setAttribute('aria-selected', String(login));
    document.getElementById('tabRegister')?.setAttribute('aria-selected', String(!login));
    setHeader(login ? 'Acessar workspace' : 'Criar acesso', login
      ? 'Entre com seu e-mail corporativo e senha.'
      : 'Crie uma organização ou ingresse usando um convite.');
  }

  function showForgot() {
    hideAllForms();
    showTabs(false);
    document.getElementById('formForgotPassword')?.classList.add('active');
    const sourceEmail = document.getElementById('loginEmail')?.value.trim();
    const target = document.getElementById('forgotEmail');
    if (target && sourceEmail) target.value = sourceEmail;
    setHeader('Recuperar senha', 'Informe seu e-mail para receber um link seguro de recuperação.');
    setTimeout(() => target?.focus(), 0);
  }

  function showReset() {
    recoveryActive = true;
    hideAllForms();
    showTabs(false);
    document.getElementById('formResetPassword')?.classList.add('active');
    setHeader('Definir nova senha', 'Crie uma nova senha para voltar a acessar seu workspace.');
    setTimeout(() => document.getElementById('resetPassword')?.focus(), 0);
  }

  injectRecoveryUI();
  document.querySelectorAll('.auth-tab').forEach(tab => tab.addEventListener('click', () => switchTab(tab.dataset.target)));
  document.getElementById('forgotPasswordButton')?.addEventListener('click', showForgot);
  document.querySelectorAll('[data-auth-back]').forEach(button => button.addEventListener('click', () => switchTab('login')));

  function bindPasswordToggles() {
    document.querySelectorAll('[data-toggle-password]').forEach(button => {
      if (button.dataset.bound === '1') return;
      button.dataset.bound = '1';
      button.addEventListener('click', () => {
        const input = document.getElementById(button.dataset.togglePassword);
        if (!input) return;
        input.type = input.type === 'password' ? 'text' : 'password';
        button.textContent = input.type === 'password' ? 'Mostrar' : 'Ocultar';
      });
    });
  }
  bindPasswordToggles();

  const requestedMode = params.get('mode');
  if (requestedMode === 'register') switchTab('register');
  const inviteFromUrl = params.get('invite');
  if (inviteFromUrl) {
    switchTab('register');
    const field = document.getElementById('registerInvite');
    if (field) field.value = inviteFromUrl;
  }
  if (recoveryHint) showReset();

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
    document.getElementById('forgotPasswordSubmit')?.setAttribute('disabled','disabled');
    return;
  }

  const client = window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  window.RRN_SUPABASE_CLIENT = client;

  async function getProfile(userId, attempts = 6) {
    let lastError = null;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const { data, error } = await client.from('profiles').select('user_id,tenant_id,name,email,role,status,tenants(name,slug)').eq('user_id', userId).maybeSingle();
      if (!error && data) {
        if (data.status !== 'active') throw new Error('Seu acesso está inativo.');
        return data;
      }
      lastError = error || new Error('Perfil ainda não disponível.');
      if (attempt < attempts - 1) await sleep(220 * (attempt + 1));
    }
    throw lastError || new Error('Não foi possível carregar seu perfil.');
  }

  function saveCompat(profile) {
    localStorage.setItem('usuarioLogado', JSON.stringify({ id: profile.user_id, nome: profile.name || profile.email || 'Usuário', email: profile.email || '', perfil: profile.role || 'monitoramento', tenant_id: profile.tenant_id, tenant: profile.tenants?.name || 'Workspace' }));
  }

  document.getElementById('formLogin')?.addEventListener('submit', async event => {
    event.preventDefault();
    const msg = document.getElementById('loginMsg');
    const button = document.getElementById('loginButton');
    const email = document.getElementById('loginEmail')?.value.trim().toLowerCase();
    const password = document.getElementById('loginSenha')?.value || '';
    if (!email || !password) return setMessage(msg, 'Informe e-mail e senha.', 'error');
    setMessage(msg); setBusy(button, true, 'Autenticando...');
    try {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const profile = await getProfile(data.user.id);
      saveCompat(profile); sessionStorage.removeItem('rrn_hydrated_tenant'); location.replace('dashboard.html');
    } catch (error) {
      if (/acesso está inativo/i.test(error.message || '')) await client.auth.signOut().catch(() => undefined);
      setMessage(msg, /Invalid login credentials/i.test(error.message || '') ? 'E-mail ou senha inválidos.' : (error.message || 'Não foi possível entrar.'), 'error');
    } finally { setBusy(button, false); }
  });

  document.getElementById('formForgotPassword')?.addEventListener('submit', async event => {
    event.preventDefault();
    const email = document.getElementById('forgotEmail')?.value.trim().toLowerCase();
    const msg = document.getElementById('forgotPasswordMsg');
    const button = document.getElementById('forgotPasswordSubmit');
    if (!email) return setMessage(msg, 'Informe seu e-mail.', 'error');
    setMessage(msg); setBusy(button, true, 'Enviando...');
    try {
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: authRedirectUrl });
      if (error) throw error;
      setMessage(msg, 'Se este e-mail estiver cadastrado, você receberá um link para redefinir a senha.', 'success');
    } catch (error) {
      setMessage(msg, error.message || 'Não foi possível enviar o link de recuperação.', 'error');
    } finally { setBusy(button, false); }
  });

  document.getElementById('formResetPassword')?.addEventListener('submit', async event => {
    event.preventDefault();
    const password = document.getElementById('resetPassword')?.value || '';
    const confirm = document.getElementById('resetPasswordConfirm')?.value || '';
    const msg = document.getElementById('resetPasswordMsg');
    const button = document.getElementById('resetPasswordButton');
    if (password.length < 8) return setMessage(msg, 'Use uma senha com pelo menos 8 caracteres.', 'error');
    if (password !== confirm) return setMessage(msg, 'As senhas não conferem.', 'error');
    setMessage(msg); setBusy(button, true, 'Salvando...');
    try {
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      await client.auth.signOut();
      history.replaceState(null, '', '/login.html');
      switchTab('login');
      setMessage(document.getElementById('loginMsg'), 'Senha redefinida com sucesso. Entre com sua nova senha.', 'success');
    } catch (error) {
      setMessage(msg, error.message || 'Não foi possível redefinir a senha. Solicite um novo link.', 'error');
    } finally { setBusy(button, false); }
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
    setMessage(msg); setBusy(button, true, 'Criando acesso...');
    try {
      const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: authRedirectUrl, data: { name, organization_name: organization || '', invite_code: invite || '' } } });
      if (error) throw error;
      if (data.session?.user) { const profile = await getProfile(data.session.user.id); saveCompat(profile); location.replace('dashboard.html'); return; }
      document.getElementById('formRegister')?.reset();
      const loginEmail = document.getElementById('loginEmail'); if (loginEmail) loginEmail.value = email;
      switchTab('login'); setMessage(document.getElementById('loginMsg'), 'Cadastro criado. Confirme seu e-mail e depois entre com sua senha.', 'success');
    } catch (error) { setMessage(msg, error.message || 'Não foi possível criar o acesso.', 'error'); }
    finally { setBusy(button, false); }
  });

  client.auth.onAuthStateChange(event => {
    if (event === 'PASSWORD_RECOVERY') showReset();
  });

  client.auth.getSession().then(async ({ data }) => {
    if (recoveryActive || recoveryHint || !data.session?.user) return;
    try {
      const profile = await getProfile(data.session.user.id); saveCompat(profile); location.replace('dashboard.html');
    } catch (error) {
      if (/acesso está inativo/i.test(error.message || '')) await client.auth.signOut().catch(() => undefined);
      console.warn(error);
    }
  });
})();