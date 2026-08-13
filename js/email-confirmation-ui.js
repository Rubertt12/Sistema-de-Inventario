(() => {
  'use strict';
  if (window.__RRN_EMAIL_CONFIRMATION_UI__) return;
  window.__RRN_EMAIL_CONFIRMATION_UI__ = true;

  const $ = id => document.getElementById(id);
  const cfg = window.RRN_SUPABASE || {};
  const STORAGE_EMAIL = 'rrn_pending_confirmation_email';
  const STORAGE_RESEND_AT = 'rrn_confirmation_resend_at';
  const RESEND_COOLDOWN_MS = 60000;

  let lastEmail = String(sessionStorage.getItem(STORAGE_EMAIL) || '').trim().toLowerCase();
  let countdownTimer = null;

  function ensureStyles() {
    if ($('rrnEmailConfirmationStyle')) return;
    const style = document.createElement('style');
    style.id = 'rrnEmailConfirmationStyle';
    style.textContent = `
      .rrn-confirmation-card{display:grid;gap:14px;text-align:center}.rrn-confirmation-card[hidden]{display:none!important}.rrn-confirmation-icon{width:58px;height:58px;margin:0 auto;display:grid;place-items:center;border-radius:18px;background:color-mix(in srgb,var(--rrn-secondary,#2F7D78) 12%,var(--rrn-surface,#fff));font-size:1.6rem}.rrn-confirmation-copy{display:grid;gap:7px}.rrn-confirmation-copy strong{color:var(--rrn-heading,#163A4D);font:800 1.05rem Manrope,Inter,sans-serif}.rrn-confirmation-copy p{margin:0;color:var(--rrn-muted,#66757F);font-size:.82rem;line-height:1.5}.rrn-confirmation-email{display:block;padding:10px 12px;border-radius:10px;background:color-mix(in srgb,var(--rrn-secondary,#2F7D78) 7%,var(--rrn-surface,#fff));border:1px solid var(--rrn-border,rgba(22,58,77,.15));color:var(--rrn-heading,#163A4D);font-weight:800;word-break:break-word}.rrn-confirmation-actions{display:grid;gap:8px}.rrn-confirmation-hint{padding:10px 12px;border-radius:10px;background:color-mix(in srgb,var(--rrn-accent,#D97745) 8%,var(--rrn-surface,#fff));color:var(--rrn-muted,#66757F);font-size:.72rem;line-height:1.45}.rrn-confirmation-status{min-height:18px;margin:0;font-size:.76rem;font-weight:700}.rrn-confirmation-status.success{color:var(--rrn-success,#2F7D78)}.rrn-confirmation-status.error{color:var(--rrn-danger,#B9473A)}
    `;
    document.head.appendChild(style);
  }

  function ensurePanel() {
    if ($('formEmailConfirmation')) return;
    const register = $('formRegister');
    if (!register) return;
    ensureStyles();
    register.insertAdjacentHTML('afterend', `
      <section id="formEmailConfirmation" class="auth-form rrn-confirmation-card" aria-live="polite" hidden>
        <div class="rrn-confirmation-icon">✉️</div>
        <div class="rrn-confirmation-copy">
          <strong>Confirme seu e-mail</strong>
          <p>Enviamos um link de confirmação para:</p>
          <span class="rrn-confirmation-email" id="confirmationEmail">—</span>
          <p>Clique no link recebido antes de entrar no RRN Manager.</p>
        </div>
        <div class="rrn-confirmation-hint">Não encontrou? Verifique também as pastas <strong>Spam</strong>, <strong>Lixo eletrônico</strong> e <strong>Promoções</strong>.</div>
        <div class="rrn-confirmation-actions">
          <button type="button" class="btn-primary" id="resendConfirmationButton">Reenviar e-mail de confirmação</button>
          <button type="button" class="rrn-auth-link" id="confirmationBackToLogin">Voltar para o login</button>
        </div>
        <p class="rrn-confirmation-status" id="confirmationStatus" role="status"></p>
      </section>`);

    $('resendConfirmationButton')?.addEventListener('click', resendConfirmation);
    $('confirmationBackToLogin')?.addEventListener('click', backToLogin);
    $('tabLogin')?.addEventListener('click', hideConfirmationPanel);
    $('tabRegister')?.addEventListener('click', hideConfirmationPanel);
  }

  function setStatus(text = '', type = '') {
    const el = $('confirmationStatus');
    if (!el) return;
    el.textContent = text;
    el.className = `rrn-confirmation-status ${type}`.trim();
  }

  function rememberEmail(value) {
    const email = String(value || '').trim().toLowerCase();
    if (!email) return;
    lastEmail = email;
    sessionStorage.setItem(STORAGE_EMAIL, email);
  }

  function hideTabs(hidden) {
    const tabs = document.querySelector('.auth-tabs');
    if (tabs) tabs.hidden = hidden;
  }

  function hideConfirmationPanel() {
    const panel = $('formEmailConfirmation');
    if (!panel) return;
    panel.hidden = true;
    panel.classList.remove('active');
  }

  function showConfirmation(email, reason = 'signup') {
    ensurePanel();
    rememberEmail(email || lastEmail || $('loginEmail')?.value || $('registerEmail')?.value);
    if (!lastEmail) return;

    document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
    const panel = $('formEmailConfirmation');
    if (panel) {
      panel.hidden = false;
      panel.classList.add('active');
    }
    hideTabs(true);
    if ($('authTitle')) $('authTitle').textContent = 'Confirme seu e-mail';
    if ($('authSubtitle')) $('authSubtitle').textContent = reason === 'login'
      ? 'Seu e-mail ainda não foi confirmado. Confirme para continuar.'
      : 'Seu cadastro foi criado. Falta apenas confirmar seu endereço de e-mail.';
    if ($('confirmationEmail')) $('confirmationEmail').textContent = lastEmail;
    setStatus(reason === 'login' ? 'Você precisa confirmar o e-mail antes de entrar.' : 'O primeiro e-mail já foi enviado.', reason === 'login' ? 'error' : 'success');
    syncCooldown();
  }

  function backToLogin() {
    hideConfirmationPanel();
    hideTabs(false);
    if ($('loginEmail') && lastEmail) $('loginEmail').value = lastEmail;
    $('tabLogin')?.click();
    setTimeout(() => $('loginSenha')?.focus(), 0);
  }

  function remainingCooldown() {
    const sentAt = Number(sessionStorage.getItem(STORAGE_RESEND_AT) || 0);
    return Math.max(0, RESEND_COOLDOWN_MS - (Date.now() - sentAt));
  }

  function syncCooldown() {
    clearInterval(countdownTimer);
    const button = $('resendConfirmationButton');
    if (!button) return;

    const update = () => {
      const remaining = remainingCooldown();
      if (remaining <= 0) {
        button.disabled = false;
        button.textContent = 'Reenviar e-mail de confirmação';
        clearInterval(countdownTimer);
        return;
      }
      button.disabled = true;
      button.textContent = `Reenviar em ${Math.ceil(remaining / 1000)}s`;
    };

    update();
    if (remainingCooldown() > 0) countdownTimer = setInterval(update, 1000);
  }

  async function resendConfirmation() {
    rememberEmail(lastEmail || $('loginEmail')?.value || $('registerEmail')?.value);
    if (!lastEmail) return setStatus('Informe seu e-mail novamente no login.', 'error');
    if (remainingCooldown() > 0) return syncCooldown();

    const client = window.RRN_SUPABASE_CLIENT || window.supabase?.createClient?.(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    if (!client) return setStatus('Serviço de autenticação indisponível.', 'error');
    window.RRN_SUPABASE_CLIENT = client;

    const button = $('resendConfirmationButton');
    button.disabled = true;
    button.textContent = 'Reenviando...';
    setStatus('');
    try {
      const { error } = await client.auth.resend({
        type: 'signup',
        email: lastEmail,
        options: { emailRedirectTo: `${location.origin}/login.html` }
      });
      if (error) throw error;
      sessionStorage.setItem(STORAGE_RESEND_AT, String(Date.now()));
      setStatus('E-mail reenviado. Verifique sua caixa de entrada e o spam.', 'success');
    } catch (error) {
      const message = String(error?.message || '');
      if (/already.*confirm|already.*verified/i.test(message)) {
        setStatus('Este e-mail já pode estar confirmado. Volte ao login e tente entrar.', 'success');
      } else if (/rate|seconds|security purposes/i.test(message)) {
        sessionStorage.setItem(STORAGE_RESEND_AT, String(Date.now()));
        setStatus('Aguarde um pouco antes de solicitar outro e-mail.', 'error');
      } else {
        setStatus('Não foi possível reenviar agora. Tente novamente em instantes.', 'error');
      }
    } finally {
      syncCooldown();
    }
  }

  function messageIndicatesConfirmation(text) {
    return /confirme seu e-mail|confirme o seu e-mail|email not confirmed|email.*not.*confirm|e-mail.*não.*confirm/i.test(String(text || ''));
  }

  function observeLoginMessage() {
    const msg = $('loginMsg');
    if (!msg) return;
    const inspect = () => {
      if (!messageIndicatesConfirmation(msg.textContent)) return;
      const reason = /not confirmed|não.*confirm/i.test(msg.textContent || '') ? 'login' : 'signup';
      setTimeout(() => showConfirmation(lastEmail || $('loginEmail')?.value || $('registerEmail')?.value, reason), 0);
    };
    new MutationObserver(inspect).observe(msg, { childList: true, characterData: true, subtree: true });
    inspect();
  }

  function captureEmails() {
    $('formRegister')?.addEventListener('submit', () => rememberEmail($('registerEmail')?.value), true);
    $('formLogin')?.addEventListener('submit', () => rememberEmail($('loginEmail')?.value), true);
  }

  ensurePanel();
  hideConfirmationPanel();
  captureEmails();
  observeLoginMessage();

  window.RRN_EMAIL_CONFIRMATION = {
    show: showConfirmation,
    resend: resendConfirmation,
    getEmail: () => lastEmail
  };
})();