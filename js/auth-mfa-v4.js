(() => {
  'use strict';
  if (window.__RRN_AUTH_MFA_V4__) return;
  window.__RRN_AUTH_MFA_V4__ = true;

  const cfg = window.RRN_SUPABASE || {};
  const params = new URLSearchParams(location.search);
  const requestedSlug = (params.get('org') || '').trim().toLowerCase();
  const recoveryHint = params.get('type') === 'recovery' || /(?:^|[&#])type=recovery(?:&|$)/i.test(location.hash);
  const redirectTarget = (() => {
    const raw = params.get('next');
    return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/dashboard.html';
  })();
  const configured = /^https:\/\/.+\.supabase\.co$/i.test(cfg.url || '') && Boolean(cfg.anonKey);
  const $ = id => document.getElementById(id);
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  let recoveryActive = recoveryHint;
  let targetTenant = null;
  let pendingEnroll = null;

  function setMessage(el, text = '', type = '') {
    if (!el) return;
    el.textContent = text;
    el.classList.remove('error', 'success');
    if (type) el.classList.add(type);
  }

  function setBusy(button, busy, text = 'Processando...') {
    if (!button) return;
    button.dataset.originalText ||= button.textContent.trim();
    button.disabled = busy;
    button.textContent = busy ? text : button.dataset.originalText;
  }

  function setHeader(title, subtitle) {
    if ($('authTitle')) $('authTitle').textContent = title;
    if ($('authSubtitle')) $('authSubtitle').textContent = subtitle;
  }

  const forms = () => ['formLogin','formRegister','formForgotPassword','formResetPassword','formMfaChallenge','formMfaOffer','formMfaEnroll'];
  function hideForms() { forms().forEach(id => $(id)?.classList.remove('active')); }
  function showTabs(show) { const tabs = document.querySelector('.auth-tabs'); if (tabs) tabs.hidden = !show; }

  function switchTab(target) {
    recoveryActive = false;
    const login = target === 'login';
    hideForms();
    $(login ? 'formLogin' : 'formRegister')?.classList.add('active');
    showTabs(true);
    $('tabLogin')?.classList.toggle('active', login);
    $('tabRegister')?.classList.toggle('active', !login);
    $('tabLogin')?.setAttribute('aria-selected', String(login));
    $('tabRegister')?.setAttribute('aria-selected', String(!login));
    setHeader(login ? 'Acessar workspace' : 'Criar acesso', login
      ? 'Entre primeiro com seu e-mail e senha.'
      : 'Crie sua conta. A autenticação em dois fatores pode ser ativada depois.');
  }

  function injectUi() {
    if ($('formForgotPassword')) return;
    const passwordField = $('loginSenha')?.closest('.field');
    const forgot = document.createElement('button');
    forgot.type = 'button';
    forgot.id = 'forgotPasswordButton';
    forgot.className = 'rrn-auth-link';
    forgot.textContent = 'Esqueci minha senha';
    passwordField?.insertAdjacentElement('afterend', forgot);

    $('formRegister')?.insertAdjacentHTML('afterend', `
      <form id="formForgotPassword" class="auth-form" novalidate>
        <div class="rrn-auth-back"><button type="button" data-auth-back>Voltar para o login</button></div>
        <label class="field"><span>E-mail</span><input type="email" id="forgotEmail" autocomplete="email" required></label>
        <button type="submit" class="btn-primary" id="forgotPasswordSubmit">Enviar link de recuperação</button>
        <p class="form-message" id="forgotPasswordMsg" role="status"></p>
      </form>
      <form id="formResetPassword" class="auth-form" novalidate>
        <label class="field"><span>Nova senha</span><div class="password-field"><input type="password" id="resetPassword" minlength="8" autocomplete="new-password" required><button type="button" class="password-toggle" data-toggle-password="resetPassword">Mostrar</button></div></label>
        <label class="field"><span>Confirmar nova senha</span><div class="password-field"><input type="password" id="resetPasswordConfirm" minlength="8" autocomplete="new-password" required><button type="button" class="password-toggle" data-toggle-password="resetPasswordConfirm">Mostrar</button></div></label>
        <button type="submit" class="btn-primary" id="resetPasswordButton">Definir nova senha</button>
        <p class="form-message" id="resetPasswordMsg" role="status"></p>
      </form>
      <form id="formMfaChallenge" class="auth-form rrn-mfa-form" novalidate>
        <div class="rrn-mfa-icon">🔐</div>
        <label class="field" id="mfaFactorField"><span>Autenticador</span><select id="mfaFactorSelect"></select></label>
        <label class="field"><span>Código de autenticação</span><input id="mfaChallengeCode" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="one-time-code" placeholder="000000" required><small>Abra seu aplicativo autenticador e informe o código atual de 6 dígitos.</small></label>
        <button type="submit" class="btn-primary" id="mfaChallengeButton">Verificar e entrar</button>
        <button type="button" class="rrn-auth-link" data-mfa-signout>Sair desta conta</button>
        <p class="form-message" id="mfaChallengeMsg" role="status"></p>
      </form>
      <section id="formMfaOffer" class="auth-form rrn-mfa-form">
        <div class="rrn-mfa-icon">🛡️</div>
        <div class="rrn-mfa-offer-copy"><strong>Quer proteger sua conta com 2FA?</strong><p>É opcional. Se você ativar, nos próximos logins o RRN pedirá o código do autenticador somente depois de validar seu e-mail e senha.</p></div>
        <button type="button" class="btn-primary" id="mfaOfferEnable">Ativar 2FA agora</button>
        <button type="button" class="rrn-auth-link" id="mfaOfferSkip">Agora não</button>
      </section>
      <form id="formMfaEnroll" class="auth-form rrn-mfa-form" novalidate>
        <div class="rrn-mfa-icon">🛡️</div>
        <div class="rrn-mfa-setup"><img id="mfaEnrollQr" alt="QR Code para configurar autenticação em dois fatores"><div><strong>Escaneie o QR Code</strong><small>Use Google Authenticator, Microsoft Authenticator, Authy, 1Password ou outro aplicativo TOTP.</small><code id="mfaEnrollSecret"></code></div></div>
        <label class="field"><span>Confirme o código</span><input id="mfaEnrollCode" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="one-time-code" placeholder="000000" required></label>
        <button type="submit" class="btn-primary" id="mfaEnrollButton">Ativar autenticação em dois fatores</button>
        <button type="button" class="rrn-auth-link" id="mfaEnrollCancel">Cancelar e continuar sem 2FA</button>
        <p class="form-message" id="mfaEnrollMsg" role="status"></p>
      </form>`);

    const style = document.createElement('style');
    style.id = 'rrnMfaV4ExtraStyle';
    style.textContent = '.rrn-mfa-offer-copy{display:grid;gap:8px;text-align:center}.rrn-mfa-offer-copy strong{font-size:1.05rem;color:var(--rrn-heading,#163A4D)}.rrn-mfa-offer-copy p{margin:0;color:var(--rrn-muted,#66757F);font-size:.86rem;line-height:1.5}';
    document.head.appendChild(style);
  }

  function bindPasswordToggles() {
    document.querySelectorAll('[data-toggle-password]').forEach(button => {
      if (button.dataset.bound === '1') return;
      button.dataset.bound = '1';
      button.onclick = () => {
        const input = $(button.dataset.togglePassword);
        if (!input) return;
        input.type = input.type === 'password' ? 'text' : 'password';
        button.textContent = input.type === 'password' ? 'Mostrar' : 'Ocultar';
      };
    });
  }

  injectUi();
  bindPasswordToggles();

  if (!configured || !window.supabase?.createClient) {
    if ($('backendNotice')) { $('backendNotice').hidden = false; $('backendNotice').textContent = 'O backend ainda não foi configurado.'; }
    return;
  }

  const client = window.RRN_SUPABASE_CLIENT || window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  window.RRN_SUPABASE_CLIENT = client;

  async function getProfile(userId, attempts = 6) {
    let lastError = null;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const { data, error } = await client.from('profiles')
        .select('user_id,tenant_id,name,email,role,status,tenants(name,slug,status)')
        .eq('user_id', userId).maybeSingle();
      if (!error && data) {
        if (data.status !== 'active') throw new Error('Seu acesso está inativo.');
        return data;
      }
      lastError = error || new Error('Perfil ainda não disponível.');
      if (attempt < attempts - 1) await sleep(220 * (attempt + 1));
    }
    throw lastError || new Error('Não foi possível carregar seu perfil.');
  }

  function profileMatchesPortal(profile) {
    if (!requestedSlug) return true;
    return String(profile?.tenants?.slug || '').toLowerCase() === requestedSlug && profile?.tenants?.status !== 'inactive';
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
    if (requestedSlug) sessionStorage.setItem('rrn_login_tenant_slug', requestedSlug);
  }

  async function listVerifiedFactors() {
    const { data, error } = await client.auth.mfa.listFactors();
    if (error) throw error;
    return (data?.totp || []).filter(factor => factor?.status === 'verified');
  }

  async function challengeMfa(factors) {
    hideForms(); showTabs(false);
    setHeader('Verificação em duas etapas', 'Senha correta. Agora confirme o segundo fator para entrar.');
    $('formMfaChallenge')?.classList.add('active');
    const select = $('mfaFactorSelect');
    select.innerHTML = factors.map((factor, index) => `<option value="${factor.id}">${factor.friendly_name || `Autenticador ${index + 1}`}</option>`).join('');
    $('mfaFactorField').hidden = factors.length <= 1;
    $('mfaChallengeCode').value = '';
    setMessage($('mfaChallengeMsg'));
    setTimeout(() => $('mfaChallengeCode')?.focus(), 0);

    return new Promise((resolve, reject) => {
      $('formMfaChallenge').onsubmit = async event => {
        event.preventDefault();
        const code = $('mfaChallengeCode').value.trim();
        if (!/^\d{6}$/.test(code)) return setMessage($('mfaChallengeMsg'), 'Digite o código de 6 dígitos.', 'error');
        setBusy($('mfaChallengeButton'), true, 'Verificando...');
        try {
          const { error } = await client.auth.mfa.challengeAndVerify({ factorId: select.value, code });
          if (error) throw error;
          const { data: aal } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
          if (aal?.currentLevel !== 'aal2') throw new Error('Não foi possível elevar a sessão para AAL2.');
          resolve(true);
        } catch {
          setMessage($('mfaChallengeMsg'), 'Código inválido ou expirado. Tente novamente.', 'error');
          $('mfaChallengeCode').select();
        } finally { setBusy($('mfaChallengeButton'), false); }
      };
      document.querySelectorAll('[data-mfa-signout]').forEach(button => button.onclick = async () => {
        await client.auth.signOut().catch(() => undefined);
        reject(new Error('MFA_CANCELLED'));
        location.replace('/login.html');
      });
    });
  }

  function offerMfaSetup() {
    hideForms(); showTabs(false);
    setHeader('Segurança da conta', 'Sua senha foi validada. O 2FA é opcional e pode ser ativado agora.');
    $('formMfaOffer')?.classList.add('active');
    return new Promise(resolve => {
      $('mfaOfferEnable').onclick = () => resolve('enable');
      $('mfaOfferSkip').onclick = () => resolve('skip');
    });
  }

  async function enrollMfa() {
    const { data, error } = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'RRN Manager' });
    if (error) throw error;
    pendingEnroll = data;
    hideForms(); showTabs(false);
    setHeader('Ativar autenticação em dois fatores', 'Escaneie o QR Code e confirme o primeiro código do seu aplicativo.');
    $('formMfaEnroll')?.classList.add('active');
    $('mfaEnrollQr').src = data.totp.qr_code;
    $('mfaEnrollSecret').textContent = data.totp.secret || '';
    $('mfaEnrollCode').value = '';
    setMessage($('mfaEnrollMsg'));
    setTimeout(() => $('mfaEnrollCode')?.focus(), 0);

    return new Promise(resolve => {
      $('formMfaEnroll').onsubmit = async event => {
        event.preventDefault();
        const code = $('mfaEnrollCode').value.trim();
        if (!/^\d{6}$/.test(code)) return setMessage($('mfaEnrollMsg'), 'Digite o código de 6 dígitos.', 'error');
        setBusy($('mfaEnrollButton'), true, 'Ativando...');
        try {
          const { error: verifyError } = await client.auth.mfa.challengeAndVerify({ factorId: data.id, code });
          if (verifyError) throw verifyError;
          pendingEnroll = null;
          resolve(true);
        } catch {
          setMessage($('mfaEnrollMsg'), 'Código inválido ou expirado. Confira o aplicativo e tente novamente.', 'error');
          $('mfaEnrollCode').select();
        } finally { setBusy($('mfaEnrollButton'), false); }
      };
      $('mfaEnrollCancel').onclick = async () => {
        if (pendingEnroll?.id) await client.auth.mfa.unenroll({ factorId: pendingEnroll.id }).catch(() => undefined);
        pendingEnroll = null;
        resolve(false);
      };
    });
  }

  async function handleMfa({ offerSetup = false } = {}) {
    const [{ data: aal, error: aalError }, factors] = await Promise.all([
      client.auth.mfa.getAuthenticatorAssuranceLevel(),
      listVerifiedFactors()
    ]);
    if (aalError) throw aalError;
    if (aal?.currentLevel === 'aal2') return true;
    if (factors.length) return challengeMfa(factors);
    if (!offerSetup) return true;
    const choice = await offerMfaSetup();
    if (choice === 'enable') await enrollMfa();
    return true;
  }

  async function finishLogin(userId, options = {}) {
    const profile = await getProfile(userId);
    if (!profileMatchesPortal(profile)) {
      const actual = profile?.tenants?.name || 'outra empresa';
      await client.auth.signOut().catch(() => undefined);
      throw new Error(`Esta conta pertence a ${actual} e não a este ambiente.`);
    }
    await handleMfa(options);
    saveCompat(profile);
    sessionStorage.removeItem('rrn_hydrated_tenant');
    location.replace(redirectTarget);
  }

  async function resolvePortal() {
    if (!requestedSlug) return;
    const { data, error } = await client.rpc('get_public_tenant_branding', { p_slug: requestedSlug });
    if (error) throw error;
    targetTenant = Array.isArray(data) ? data[0] : data;
    if (!targetTenant?.tenant_slug) throw new Error('Esta empresa não existe ou está inativa.');
    setHeader(`Acessar ${targetTenant.tenant_name}`, 'Use uma conta vinculada a esta empresa para continuar.');
  }

  function showForgot() {
    hideForms(); showTabs(false); $('formForgotPassword')?.classList.add('active');
    if ($('forgotEmail')) $('forgotEmail').value = $('loginEmail')?.value.trim() || '';
    setHeader('Recuperar senha', 'Informe seu e-mail para receber um link seguro de recuperação.');
  }

  function showReset() {
    recoveryActive = true;
    hideForms(); showTabs(false); $('formResetPassword')?.classList.add('active');
    setHeader('Definir nova senha', 'Crie uma nova senha para voltar a acessar seu workspace.');
  }

  document.querySelectorAll('.auth-tab').forEach(tab => tab.addEventListener('click', () => switchTab(tab.dataset.target)));
  $('forgotPasswordButton')?.addEventListener('click', showForgot);
  document.querySelectorAll('[data-auth-back]').forEach(button => button.addEventListener('click', () => switchTab('login')));

  $('formLogin')?.addEventListener('submit', async event => {
    event.preventDefault();
    const email = $('loginEmail')?.value.trim().toLowerCase();
    const password = $('loginSenha')?.value || '';
    if (!email || !password) return setMessage($('loginMsg'), 'Informe e-mail e senha.', 'error');
    setMessage($('loginMsg')); setBusy($('loginButton'), true, 'Autenticando...');
    try {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await finishLogin(data.user.id, { offerSetup: true });
    } catch (error) {
      if (error.message === 'MFA_CANCELLED') return;
      if (/acesso está inativo/i.test(error.message || '')) await client.auth.signOut().catch(() => undefined);
      setMessage($('loginMsg'), /Invalid login credentials/i.test(error.message || '') ? 'E-mail ou senha inválidos.' : (error.message || 'Não foi possível entrar.'), 'error');
      if (!$('formLogin')?.classList.contains('active')) switchTab('login');
    } finally { setBusy($('loginButton'), false); }
  });

  $('formForgotPassword')?.addEventListener('submit', async event => {
    event.preventDefault();
    const email = $('forgotEmail')?.value.trim().toLowerCase();
    if (!email) return setMessage($('forgotPasswordMsg'), 'Informe seu e-mail.', 'error');
    setBusy($('forgotPasswordSubmit'), true, 'Enviando...');
    try {
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/login.html` });
      if (error) throw error;
      setMessage($('forgotPasswordMsg'), 'Se este e-mail estiver cadastrado, você receberá um link para redefinir a senha.', 'success');
    } catch (error) { setMessage($('forgotPasswordMsg'), error.message || 'Não foi possível enviar o link.', 'error'); }
    finally { setBusy($('forgotPasswordSubmit'), false); }
  });

  $('formResetPassword')?.addEventListener('submit', async event => {
    event.preventDefault();
    const password = $('resetPassword')?.value || '';
    const confirm = $('resetPasswordConfirm')?.value || '';
    if (password.length < 8) return setMessage($('resetPasswordMsg'), 'Use uma senha com pelo menos 8 caracteres.', 'error');
    if (password !== confirm) return setMessage($('resetPasswordMsg'), 'As senhas não conferem.', 'error');
    setBusy($('resetPasswordButton'), true, 'Salvando...');
    try {
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      await client.auth.signOut();
      history.replaceState(null, '', '/login.html');
      switchTab('login');
      setMessage($('loginMsg'), 'Senha redefinida com sucesso. Entre novamente.', 'success');
    } catch (error) { setMessage($('resetPasswordMsg'), error.message || 'Não foi possível redefinir a senha.', 'error'); }
    finally { setBusy($('resetPasswordButton'), false); }
  });

  $('formRegister')?.addEventListener('submit', async event => {
    event.preventDefault();
    const name = $('registerName')?.value.trim();
    const email = $('registerEmail')?.value.trim().toLowerCase();
    const password = $('registerPassword')?.value || '';
    const organization = $('registerOrganization')?.value.trim();
    const invite = $('registerInvite')?.value.trim();
    if (!name || !email || password.length < 8) return setMessage($('registerMsg'), 'Preencha nome, e-mail e uma senha com pelo menos 8 caracteres.', 'error');
    if (!organization && !invite) return setMessage($('registerMsg'), 'Informe a organização ou um código de convite.', 'error');
    if (!$('acceptTerms')?.checked) return setMessage($('registerMsg'), 'Confirme que você está autorizado a criar ou ingressar no workspace.', 'error');
    setBusy($('registerButton'), true, 'Criando acesso...');
    try {
      const { data, error } = await client.auth.signUp({
        email, password,
        options: { emailRedirectTo: `${location.origin}/login.html`, data: { name, organization_name: organization || '', invite_code: invite || '' } }
      });
      if (error) throw error;
      if (data.session?.user) return await finishLogin(data.session.user.id, { offerSetup: false });
      $('formRegister')?.reset();
      if ($('loginEmail')) $('loginEmail').value = email;
      switchTab('login');
      setMessage($('loginMsg'), 'Cadastro criado. Confirme seu e-mail e depois entre com sua senha. O 2FA poderá ser ativado após o login.', 'success');
    } catch (error) { setMessage($('registerMsg'), error.message || 'Não foi possível criar o acesso.', 'error'); }
    finally { setBusy($('registerButton'), false); }
  });

  client.auth.onAuthStateChange(event => { if (event === 'PASSWORD_RECOVERY') showReset(); });

  (async () => {
    try {
      await resolvePortal();
      if (params.get('mode') === 'register') switchTab('register');
      if (params.get('invite')) { switchTab('register'); if ($('registerInvite')) $('registerInvite').value = params.get('invite'); }
      if (recoveryHint) return showReset();
      const { data } = await client.auth.getSession();
      if (data.session?.user) await finishLogin(data.session.user.id, { offerSetup: false });
    } catch (error) {
      if (error.message === 'MFA_CANCELLED') return;
      if (requestedSlug && /não existe|inativa/i.test(error.message || '')) {
        setMessage($('loginMsg'), error.message, 'error');
        if ($('loginButton')) $('loginButton').disabled = true;
      } else console.warn('RRN auth:', error);
    }
  })();
})();