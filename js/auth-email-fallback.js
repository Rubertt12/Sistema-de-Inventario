(() => {
  'use strict';
  if (window.__RRN_AUTH_EMAIL_FALLBACK__) return;
  window.__RRN_AUTH_EMAIL_FALLBACK__ = true;

  const $ = id => document.getElementById(id);
  const client = window.RRN_SUPABASE_CLIENT;
  if (!client) return;

  const params = new URLSearchParams(location.search);
  const requestedSlug = (params.get('org') || '').trim().toLowerCase();
  const redirectTarget = (() => {
    const raw = params.get('next');
    return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/dashboard.html';
  })();

  let expectedUserId = '';
  let fallbackEmail = '';
  let resendTimer = null;
  let resendRemaining = 0;

  function setHeader(title, subtitle) {
    if ($('authTitle')) $('authTitle').textContent = title;
    if ($('authSubtitle')) $('authSubtitle').textContent = subtitle;
  }

  function setMessage(text = '', type = '') {
    const el = $('mfaEmailFallbackMsg');
    if (!el) return;
    el.textContent = text;
    el.classList.remove('error', 'success');
    if (type) el.classList.add(type);
  }

  function setBusy(button, busy, busyText = 'Processando...') {
    if (!button) return;
    button.dataset.originalText ||= button.textContent.trim();
    button.disabled = busy;
    button.textContent = busy ? busyText : button.dataset.originalText;
  }

  function maskEmail(email) {
    const [local = '', domain = ''] = String(email || '').split('@');
    if (!domain) return email || '';
    const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
    return `${visible}${'*'.repeat(Math.max(3, local.length - visible.length))}@${domain}`;
  }

  function ensureStyle() {
    if ($('rrnEmailFallbackStyle')) return;
    const style = document.createElement('style');
    style.id = 'rrnEmailFallbackStyle';
    style.textContent = `
      .rrn-email-fallback-note{margin:2px 0 8px;padding:12px 14px;border:1px solid rgba(20,53,91,.12);border-radius:12px;background:rgba(20,53,91,.05);color:#66757f;font-size:.82rem;line-height:1.5}
      .rrn-email-fallback-note strong{color:#163a4d}
      .rrn-email-fallback-actions{display:grid;gap:8px;margin-top:8px}
      .rrn-email-code{font-variant-numeric:tabular-nums;letter-spacing:.3em;text-align:center;font-size:1.18rem;font-weight:700}
      .rrn-email-resend[disabled]{opacity:.55;cursor:not-allowed}
    `;
    document.head.appendChild(style);
  }

  function startResendCooldown(seconds = 60) {
    clearInterval(resendTimer);
    resendRemaining = seconds;
    const button = $('mfaEmailResend');
    const tick = () => {
      if (!button) return;
      if (resendRemaining <= 0) {
        clearInterval(resendTimer);
        button.disabled = false;
        button.textContent = 'Reenviar código';
        return;
      }
      button.disabled = true;
      button.textContent = `Reenviar em ${resendRemaining}s`;
      resendRemaining -= 1;
    };
    tick();
    resendTimer = setInterval(tick, 1000);
  }

  async function currentUser() {
    const { data, error } = await client.auth.getUser();
    if (error) throw error;
    if (!data?.user) throw new Error('Sua sessão expirou. Entre novamente.');
    return data.user;
  }

  async function sendEmailCode({ resend = false } = {}) {
    const button = resend ? $('mfaEmailResend') : $('mfaUseEmailButton');
    setBusy(button, true, resend ? 'Reenviando...' : 'Enviando...');
    setMessage();
    try {
      const user = await currentUser();
      if (!user.email) throw new Error('Sua conta não possui um e-mail confirmado para recuperação.');
      expectedUserId = user.id;
      fallbackEmail = user.email.toLowerCase();

      const { error } = await client.auth.signInWithOtp({
        email: fallbackEmail,
        options: { shouldCreateUser: false }
      });
      if (error) throw error;

      if ($('mfaEmailDestination')) $('mfaEmailDestination').textContent = maskEmail(fallbackEmail);
      setMessage('Código enviado. Confira também a caixa de spam.', 'success');
      startResendCooldown(60);
      setTimeout(() => $('mfaEmailCode')?.focus(), 0);
    } catch (error) {
      const code = error?.code || '';
      if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') {
        setMessage('Muitas tentativas em pouco tempo. Aguarde um pouco e tente novamente.', 'error');
      } else {
        setMessage(error?.message || 'Não foi possível enviar o código por e-mail.', 'error');
      }
      throw error;
    } finally {
      setBusy(button, false);
    }
  }

  async function finishEmailFallback() {
    const user = await currentUser();
    if (!expectedUserId || user.id !== expectedUserId) {
      await client.auth.signOut({ scope: 'local' }).catch(() => undefined);
      throw new Error('A conta validada por e-mail não corresponde à conta que iniciou o login.');
    }

    const { data: profile, error } = await client
      .from('profiles')
      .select('user_id,tenant_id,name,email,role,status,tenants(name,slug,status)')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw error;
    if (!profile || profile.status !== 'active') throw new Error('Seu acesso está inativo.');

    if (requestedSlug) {
      const profileSlug = String(profile?.tenants?.slug || '').toLowerCase();
      if (profileSlug !== requestedSlug || profile?.tenants?.status === 'inactive') {
        await client.auth.signOut({ scope: 'local' }).catch(() => undefined);
        throw new Error('Esta conta não pertence a este ambiente.');
      }
    }

    localStorage.setItem('usuarioLogado', JSON.stringify({
      id: profile.user_id,
      nome: profile.name || profile.email || 'Usuário',
      email: profile.email || '',
      perfil: profile.role || 'monitoramento',
      tenant_id: profile.tenant_id,
      tenant: profile.tenants?.name || 'Workspace'
    }));
    sessionStorage.setItem('rrn_email_fallback_verified', new Date().toISOString());
    sessionStorage.removeItem('rrn_hydrated_tenant');
    location.replace(redirectTarget);
  }

  function showAuthenticator() {
    $('formMfaEmailFallback')?.classList.remove('active');
    $('formMfaChallenge')?.classList.add('active');
    setHeader('Verificação em duas etapas', 'Senha correta. Agora confirme o segundo fator para entrar.');
    setTimeout(() => $('mfaChallengeCode')?.focus(), 0);
  }

  async function showEmailFallback() {
    $('formMfaChallenge')?.classList.remove('active');
    $('formMfaEmailFallback')?.classList.add('active');
    setHeader('Código por e-mail', 'Use este método caso esteja sem acesso ao seu aplicativo autenticador.');
    $('mfaEmailCode').value = '';
    try {
      await sendEmailCode();
    } catch {
      // A mensagem de erro já foi exibida no formulário.
    }
  }

  function inject() {
    const challenge = $('formMfaChallenge');
    if (!challenge || $('formMfaEmailFallback')) return false;

    ensureStyle();

    const emailButton = document.createElement('button');
    emailButton.type = 'button';
    emailButton.className = 'rrn-auth-link';
    emailButton.id = 'mfaUseEmailButton';
    emailButton.textContent = 'Estou sem o autenticador — enviar código por e-mail';
    const signout = challenge.querySelector('[data-mfa-signout]');
    challenge.insertBefore(emailButton, signout || challenge.querySelector('.form-message'));

    const form = document.createElement('form');
    form.id = 'formMfaEmailFallback';
    form.className = 'auth-form rrn-mfa-form';
    form.noValidate = true;
    form.innerHTML = `
      <div class="rrn-mfa-icon">✉️</div>
      <div class="rrn-email-fallback-note">
        Enviaremos um código temporário para <strong id="mfaEmailDestination">seu e-mail cadastrado</strong>.
        Este acesso de contingência não substitui o MFA forte para operações administrativas críticas.
      </div>
      <label class="field">
        <span>Código recebido por e-mail</span>
        <input id="mfaEmailCode" class="rrn-email-code" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="one-time-code" placeholder="000000" required>
        <small>Digite os 6 dígitos enviados pelo RRN Manager.</small>
      </label>
      <button type="submit" class="btn-primary" id="mfaEmailVerifyButton">Verificar e entrar</button>
      <div class="rrn-email-fallback-actions">
        <button type="button" class="rrn-auth-link rrn-email-resend" id="mfaEmailResend">Reenviar código</button>
        <button type="button" class="rrn-auth-link" id="mfaEmailBack">Voltar para o autenticador</button>
      </div>
      <p class="form-message" id="mfaEmailFallbackMsg" role="status"></p>
    `;
    challenge.insertAdjacentElement('afterend', form);

    emailButton.addEventListener('click', showEmailFallback);
    $('mfaEmailBack')?.addEventListener('click', showAuthenticator);
    $('mfaEmailResend')?.addEventListener('click', async () => {
      try { await sendEmailCode({ resend: true }); } catch {}
    });

    form.addEventListener('submit', async event => {
      event.preventDefault();
      const code = $('mfaEmailCode')?.value.trim() || '';
      if (!/^\d{6}$/.test(code)) return setMessage('Digite o código de 6 dígitos.', 'error');
      if (!fallbackEmail || !expectedUserId) return setMessage('Solicite um novo código antes de continuar.', 'error');

      setBusy($('mfaEmailVerifyButton'), true, 'Verificando...');
      setMessage();
      try {
        const { data, error } = await client.auth.verifyOtp({
          email: fallbackEmail,
          token: code,
          type: 'email'
        });
        if (error) throw error;
        if (!data?.user || data.user.id !== expectedUserId) throw new Error('O código não pertence a esta conta.');
        await finishEmailFallback();
      } catch (error) {
        const codeName = error?.code || '';
        if (codeName === 'otp_expired') setMessage('Código expirado. Solicite um novo.', 'error');
        else setMessage('Código inválido ou expirado. Confira o e-mail e tente novamente.', 'error');
        $('mfaEmailCode')?.select();
      } finally {
        setBusy($('mfaEmailVerifyButton'), false);
      }
    });

    return true;
  }

  if (!inject()) {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (inject() || attempts >= 40) clearInterval(timer);
    }, 100);
  }
})();