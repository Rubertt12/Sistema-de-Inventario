(() => {
  'use strict';
  if (window.__RRN_AUTH_FLOW_FIX__) return;
  window.__RRN_AUTH_FLOW_FIX__ = true;

  const path = location.pathname.toLowerCase();
  const $ = id => document.getElementById(id);

  function addStylesheet(href, marker) {
    if (document.querySelector(`link[${marker}]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute(marker, '1');
    document.head.appendChild(link);
  }

  function addScript(src, marker) {
    if (document.querySelector(`script[${marker}]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.setAttribute(marker, '1');
    document.body.appendChild(script);
  }

  function routeLegacySecurityLinks() {
    document.querySelectorAll('a[href="/seguranca.html"],a[href="seguranca.html"]').forEach(link => {
      link.href = '/configuracoes.html#security';
    });
    document.querySelectorAll('button[onclick*="seguranca.html"]').forEach(button => {
      button.removeAttribute('onclick');
      if (!button.dataset.rrnSettingsSecurityBound) {
        button.dataset.rrnSettingsSecurityBound = '1';
        button.addEventListener('click', () => { location.href = '/configuracoes.html#security'; });
      }
      const span = button.querySelector('span');
      if (span && /seguran/i.test(span.textContent || '')) span.textContent = 'Configurações';
    });
  }

  function showRegistrationCreated(email) {
    const confirmation = $('formEmailConfirmation');
    if (confirmation) confirmation.remove();
    document.querySelector('.auth-tabs')?.removeAttribute('hidden');
    if ($('loginEmail') && email) $('loginEmail').value = String(email).trim().toLowerCase();
    $('tabLogin')?.click();
    const msg = $('loginMsg');
    if (msg) {
      msg.textContent = 'Cadastro criado. Você já pode entrar com e-mail e senha. Se não usou convite, o acesso ficará aguardando liberação do Administrador Geral.';
      msg.classList.remove('error');
      msg.classList.add('success');
    }
  }

  function disableEmailConfirmationUi() {
    if (path !== '/login.html' && path !== '/index.html' && path !== '/') return;

    sessionStorage.removeItem('rrn_pending_confirmation_email');
    sessionStorage.removeItem('rrn_confirmation_resend_at');

    const note = document.querySelector('.rrn-tech-note');
    if (note) {
      note.innerHTML = '<strong>Cadastro controlado:</strong> depois do cadastro, o Administrador Geral define o tipo de acesso e libera o ambiente correto para sua conta. Não é necessária confirmação por e-mail.';
    }

    const patchApi = () => {
      const api = window.RRN_EMAIL_CONFIRMATION;
      if (api && !api.__rrnDisabled) {
        api.show = (email) => showRegistrationCreated(email || api.getEmail?.() || $('registerEmail')?.value || $('loginEmail')?.value || '');
        api.resend = async () => ({ disabled: true });
        api.__rrnDisabled = true;
      }
      $('formEmailConfirmation')?.remove();
    };

    patchApi();
    let attempts = 0;
    const timer = setInterval(() => {
      patchApi();
      attempts += 1;
      if (attempts >= 80) clearInterval(timer);
    }, 100);

    const card = $('authCard') || document.body;
    new MutationObserver(() => patchApi()).observe(card, { childList: true, subtree: true });
  }

  function fixPendingRegistrationCopy() {
    if (path !== '/usuarios.html') return;
    const apply = () => {
      const panel = $('registrationsPanel');
      if (!panel) return;
      const copy = panel.querySelector('.panel-heading p');
      if (copy) copy.textContent = 'O acesso é liberado depois que o Administrador Geral classifica o cadastro e define o ambiente.';
      panel.querySelectorAll('.rrn-pending-email-state').forEach(state => {
        state.textContent = 'Cadastro recebido';
        state.classList.remove('wait');
        state.classList.add('ok');
      });
      panel.querySelectorAll('[data-approve-registration]').forEach(button => button.removeAttribute('disabled'));
    };
    apply();
    new MutationObserver(apply).observe(document.body, { childList: true, subtree: true });
  }

  function injectMfaSettings() {
    if (path !== '/configuracoes.html') return;
    const panel = document.querySelector('[data-settings-panel="security"]');
    if (!panel) return;

    addStylesheet('/style/mfa.css', 'data-rrn-settings-mfa-css');

    const navHint = document.querySelector('[data-settings-nav="security"] small');
    if (navHint) navHint.textContent = 'Senha, 2FA e sessão';
    const headingText = panel.querySelector('.settings-page-heading p');
    if (headingText) headingText.textContent = 'Gerencie senha, autenticação em dois fatores e a sessão atual da sua conta.';

    if (!$('settingsMfaCard')) {
      const passwordCard = $('changePasswordBtn')?.closest('.settings-card');
      const wrapper = document.createElement('div');
      wrapper.innerHTML = `
        <article class="settings-card" id="settingsMfaCard">
          <div class="settings-card-head">
            <div><h2>Autenticação em dois fatores (2FA)</h2><p>Use um aplicativo autenticador para proteger os novos logins depois da senha.</p></div>
            <span class="security-badge off" id="securityStatusBadge">Verificando</span>
          </div>
          <div class="security-status">
            <div class="security-status-copy">
              <span id="securityUser">Carregando conta...</span>
              <strong id="securityStatusText">Verificando 2FA...</strong>
              <small id="securityStatusHint">Carregando política de segurança.</small>
              <small id="securityTenant">Workspace</small>
            </div>
            <span class="security-badge" id="securityAal" style="background:rgba(47,125,120,.1);color:var(--rrn-secondary,#2F7D78)">AAL1</span>
          </div>
          <div class="security-actions"><button type="button" class="security-btn primary" id="securityAddFactor">Adicionar autenticador</button></div>
          <p class="security-message" id="securityMessage" role="status"></p>
        </article>
        <article class="settings-card" id="settingsMfaDevicesCard">
          <div class="settings-card-head"><div><h2>Aplicativos autenticadores</h2><p>Você pode manter mais de um autenticador como backup.</p></div></div>
          <div class="security-factor-list" id="securityFactors"></div>
        </article>`;
      const cards = Array.from(wrapper.children);
      const anchor = passwordCard?.nextSibling || panel.querySelector('.settings-card');
      cards.forEach(card => panel.insertBefore(card, anchor));
    }

    if (!$('securityEnrollModal')) {
      const modal = document.createElement('div');
      modal.className = 'security-modal';
      modal.id = 'securityEnrollModal';
      modal.hidden = true;
      modal.innerHTML = `
        <div class="security-modal-card">
          <h2>Adicionar autenticador</h2>
          <p>Escaneie o QR Code no Google Authenticator, Microsoft Authenticator, Authy, 1Password ou outro aplicativo TOTP.</p>
          <div class="security-setup"><img id="securityEnrollQr" alt="QR Code de autenticação"><div><strong>Chave manual</strong><code class="security-secret" id="securityEnrollSecret"></code><input class="security-code" id="securityEnrollCode" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="000000"></div></div>
          <div class="security-actions" style="justify-content:flex-end"><button type="button" class="security-btn" id="securityCancelEnroll">Cancelar</button><button type="button" class="security-btn primary" id="securityVerifyEnroll">Verificar e ativar</button></div>
        </div>`;
      document.body.appendChild(modal);
    }

    addScript('/js/mfa-security.js', 'data-rrn-settings-mfa-script');
  }

  function boot() {
    routeLegacySecurityLinks();
    disableEmailConfirmationUi();
    fixPendingRegistrationCopy();
    injectMfaSettings();

    new MutationObserver(() => routeLegacySecurityLinks()).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
