(() => {
  'use strict';
  if (window.__RRN_SETTINGS_MFA_PANEL__) return;
  window.__RRN_SETTINGS_MFA_PANEL__ = true;

  function mount() {
    const panel = document.querySelector('[data-settings-panel="security"]');
    if (!panel || document.getElementById('securityMfaCard')) return;

    const sessionCard = document.getElementById('logoutSettingsBtn')?.closest('.settings-card');
    const card = document.createElement('article');
    card.className = 'settings-card security-mfa-card';
    card.id = 'securityMfaCard';
    card.innerHTML = `
      <div class="settings-card-head">
        <div>
          <h2>Autenticação em dois fatores</h2>
          <p>Proteja sua conta com um código temporário gerado no celular.</p>
        </div>
        <span class="security-badge off" id="securityStatusBadge">Carregando...</span>
      </div>

      <div class="security-mfa-summary">
        <div>
          <div class="security-mfa-identity">
            <div class="security-mfa-shield" aria-hidden="true">🔐</div>
            <div>
              <strong id="securityUser">Usuário</strong>
              <span id="securityTenant">Workspace</span>
              <small id="securityAal">Validando nível da sessão...</small>
            </div>
          </div>
          <div class="security-mfa-meta">
            <span class="security-mini-pill">TOTP</span>
            <span class="security-mini-pill">Google / Microsoft Authenticator</span>
            <span class="security-mini-pill">Opcional</span>
          </div>
        </div>
        <button type="button" class="settings-primary-btn" id="securityAddFactor">Adicionar autenticador</button>
      </div>

      <div class="security-mfa-status">
        <strong id="securityStatusText">Verificando segurança da conta...</strong>
        <p id="securityStatusHint">Aguarde enquanto consultamos os autenticadores cadastrados.</p>
      </div>

      <div class="security-factor-list" id="securityFactors"></div>
      <p class="security-message" id="securityMessage" role="status" aria-live="polite"></p>
    `;

    if (sessionCard) panel.insertBefore(card, sessionCard);
    else panel.appendChild(card);

    const modal = document.createElement('div');
    modal.id = 'securityEnrollModal';
    modal.className = 'security-enroll-modal';
    modal.hidden = true;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'securityEnrollTitle');
    modal.innerHTML = `
      <div class="security-enroll-dialog">
        <div class="security-enroll-head">
          <div>
            <span>Segurança da conta</span>
            <h2 id="securityEnrollTitle">Configurar aplicativo autenticador</h2>
            <p>Escaneie o QR Code e confirme o código de 6 dígitos para concluir.</p>
          </div>
          <button type="button" class="security-enroll-close" id="securityEnrollClose" aria-label="Fechar">×</button>
        </div>
        <div class="security-enroll-body">
          <div class="security-enroll-steps" aria-label="Etapas da configuração">
            <div class="security-enroll-step"><b>1</b> Abra o autenticador</div>
            <div class="security-enroll-step"><b>2</b> Escaneie o QR</div>
            <div class="security-enroll-step"><b>3</b> Confirme o código</div>
          </div>

          <div class="security-enroll-setup">
            <div class="security-enroll-qr"><img id="securityEnrollQr" alt="QR Code do RRN Manager para autenticação em dois fatores" /></div>
            <div>
              <span class="security-secret-label">Não consegue escanear?</span>
              <small class="security-secret-hint">Cadastre manualmente usando a chave abaixo. Não compartilhe essa chave com outras pessoas.</small>
              <div class="security-secret-row">
                <code id="securityEnrollSecret"></code>
                <button type="button" class="security-copy-btn" id="securityCopySecret">Copiar</button>
              </div>
            </div>
          </div>

          <label class="security-enroll-field">
            <span>Código de 6 dígitos</span>
            <input id="securityEnrollCode" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="one-time-code" placeholder="000000" />
          </label>

          <div class="security-enroll-actions">
            <button type="button" class="settings-ghost-btn" id="securityCancelEnroll">Cancelar</button>
            <button type="button" class="settings-primary-btn" id="securityVerifyEnroll">Ativar 2FA</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const cancel = () => document.getElementById('securityCancelEnroll')?.click();
    document.getElementById('securityEnrollClose')?.addEventListener('click', cancel);
    modal.addEventListener('click', event => { if (event.target === modal) cancel(); });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !modal.hidden) cancel();
    });

    document.getElementById('securityCopySecret')?.addEventListener('click', async event => {
      const secret = document.getElementById('securityEnrollSecret')?.textContent?.trim();
      if (!secret) return;
      try {
        await navigator.clipboard.writeText(secret);
        const button = event.currentTarget;
        const old = button.textContent;
        button.textContent = 'Copiado ✓';
        setTimeout(() => { button.textContent = old; }, 1500);
      } catch {
        const range = document.createRange();
        const el = document.getElementById('securityEnrollSecret');
        if (el) {
          range.selectNodeContents(el);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
    });

    if (!document.querySelector('script[data-rrn-settings-mfa-core]')) {
      const script = document.createElement('script');
      script.src = '/js/mfa-security.js';
      script.dataset.rrnSettingsMfaCore = '1';
      document.body.appendChild(script);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
