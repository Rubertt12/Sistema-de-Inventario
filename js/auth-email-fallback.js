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
  const PENDING_KEY = 'rrn_email_magic_fallback_pending';
  const PENDING_TTL_MS = 15 * 60 * 1000;

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

  function savePending(user) {
    const pending = {
      userId: user.id,
      email: String(user.email || '').toLowerCase(),
      requestedSlug,
      redirectTarget,
      createdAt: Date.now(),
      expiresAt: Date.now() + PENDING_TTL_MS
    };
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
    return pending;
  }

  function ensureStyle() {
    if ($('rrnEmailFallbackStyle')) return;
    const style = document.createElement('style');
    style.id = 'rrnEmailFallbackStyle';
    style.textContent = `
      .rrn-email-fallback-note{margin:2px 0 8px;padding:12px 14px;border:1px solid rgba(20,53,91,.12);border-radius:12px;background:rgba(20,53,91,.05);color:#66757f;font-size:.82rem;line-height:1.5}
      .rrn-email-fallback-note strong{color:#163a4d}
      .rrn-email-fallback-actions{display:grid;gap:8px;margin-top:8px}
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
        button.textContent = 'Reenviar link';
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

  async function sendEmailLink({ resend = false } = {}) {
    const button = resend ? $('mfaEmailResend') : $('mfaUseEmailButton');
    setBusy(button, true, resend ? 'Reenviando...' : 'Enviando...');
    setMessage();

    try {
      const user = await currentUser();
      if (!user.email) throw new Error('Sua conta não possui um e-mail cadastrado.');

      const pending = savePending(user);
      const { error } = await client.auth.signInWithOtp({
        email: pending.email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${location.origin}/login.html`
        }
      });
      if (error) throw error;

      if ($('mfaEmailDestination')) $('mfaEmailDestination').textContent = maskEmail(pending.email);
      setMessage('Link enviado. Abra o e-mail e clique em “Entrar” neste mesmo dispositivo.', 'success');
      startResendCooldown(60);
    } catch (error) {
      const code = error?.code || '';
      if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') {
        setMessage('Muitas tentativas em pouco tempo. Aguarde um pouco e tente novamente.', 'error');
      } else {
        setMessage(error?.message || 'Não foi possível enviar o link por e-mail.', 'error');
      }
      throw error;
    } finally {
      setBusy(button, false);
    }
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
    setHeader('Acesso por e-mail', 'Use este método caso esteja sem acesso ao seu aplicativo autenticador.');
    try {
      await sendEmailLink();
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
    emailButton.textContent = 'Estou sem o autenticador — enviar link por e-mail';
    const signout = challenge.querySelector('[data-mfa-signout]');
    challenge.insertBefore(emailButton, signout || challenge.querySelector('.form-message'));

    const form = document.createElement('section');
    form.id = 'formMfaEmailFallback';
    form.className = 'auth-form rrn-mfa-form';
    form.innerHTML = `
      <div class="rrn-mfa-icon">✉️</div>
      <div class="rrn-email-fallback-note">
        Enviaremos um link temporário para <strong id="mfaEmailDestination">seu e-mail cadastrado</strong>.
        Abra o link neste mesmo dispositivo para concluir o acesso. Este método de contingência não substitui o MFA forte para operações administrativas críticas.
      </div>
      <div class="rrn-email-fallback-actions">
        <button type="button" class="btn-primary rrn-email-resend" id="mfaEmailResend">Reenviar link</button>
        <button type="button" class="rrn-auth-link" id="mfaEmailBack">Voltar para o autenticador</button>
      </div>
      <p class="form-message" id="mfaEmailFallbackMsg" role="status"></p>
    `;
    challenge.insertAdjacentElement('afterend', form);

    emailButton.addEventListener('click', showEmailFallback);
    $('mfaEmailBack')?.addEventListener('click', showAuthenticator);
    $('mfaEmailResend')?.addEventListener('click', async () => {
      try { await sendEmailLink({ resend: true }); } catch {}
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