(() => {
  'use strict';

  if (window.__RRN_PASSWORD_MANAGEMENT__) return;
  window.__RRN_PASSWORD_MANAGEMENT__ = true;

  const cfg = window.RRN_SUPABASE || {};

  function client() {
    if (window.RRN_SUPABASE_CLIENT) return window.RRN_SUPABASE_CLIENT;
    if (!window.supabase?.createClient || !cfg.url || !cfg.anonKey) return null;
    window.RRN_SUPABASE_CLIENT = window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    return window.RRN_SUPABASE_CLIENT;
  }

  function passwordPolicyError(value) {
    const password = String(value || '');
    if (password.length < 12) return 'Use pelo menos 12 caracteres.';
    if (!/[a-z]/.test(password)) return 'Inclua pelo menos uma letra minúscula.';
    if (!/[A-Z]/.test(password)) return 'Inclua pelo menos uma letra maiúscula.';
    if (!/\d/.test(password)) return 'Inclua pelo menos um número.';
    if (!/[^A-Za-z0-9]/.test(password)) return 'Inclua pelo menos um símbolo.';
    return '';
  }

  function injectUI() {
    if (!document.getElementById('changePasswordMenuButton')) {
      const dropdown = document.getElementById('userDropdown');
      const configButton = dropdown?.querySelector('button');
      if (dropdown) {
        const button = document.createElement('button');
        button.id = 'changePasswordMenuButton';
        button.type = 'button';
        button.dataset.rrnIcon = 'lock';
        button.textContent = 'Alterar senha';
        button.addEventListener('click', event => {
          event.stopPropagation();
          open();
        });
        configButton?.insertAdjacentElement('afterend', button);
      }
    }

    if (!document.getElementById('passwordChangeModal')) {
      const modal = document.createElement('div');
      modal.id = 'passwordChangeModal';
      modal.className = 'rrn-password-modal';
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
      modal.innerHTML = `
        <div class="rrn-password-card" role="dialog" aria-modal="true" aria-labelledby="passwordChangeTitle">
          <button type="button" class="rrn-password-close" aria-label="Fechar">&times;</button>
          <div class="rrn-password-head">
            <span class="rrn-password-icon" data-rrn-icon="lock"></span>
            <div><h2 id="passwordChangeTitle">Alterar senha</h2><p>Confirme sua senha atual e defina uma nova senha.</p></div>
          </div>
          <form id="passwordChangeForm" novalidate>
            <label>Senha atual<div class="rrn-password-field"><input id="currentPassword" type="password" autocomplete="current-password" required><button type="button" data-password-target="currentPassword">Mostrar</button></div></label>
            <label>Nova senha<div class="rrn-password-field"><input id="newPassword" type="password" autocomplete="new-password" minlength="12" required><button type="button" data-password-target="newPassword">Mostrar</button></div></label>
            <label>Confirmar nova senha<div class="rrn-password-field"><input id="confirmNewPassword" type="password" autocomplete="new-password" minlength="12" required><button type="button" data-password-target="confirmNewPassword">Mostrar</button></div></label>
            <small class="rrn-password-hint">Use 12+ caracteres com maiúscula, minúscula, número e símbolo.</small>
            <p id="passwordChangeMsg" class="rrn-password-message" role="status"></p>
            <div class="rrn-password-actions"><button type="button" class="rrn-password-cancel">Cancelar</button><button type="submit" id="passwordChangeButton" class="rrn-password-save">Alterar senha</button></div>
          </form>
        </div>`;
      document.body.appendChild(modal);
    }

    if (!document.getElementById('rrnPasswordManagementStyles')) {
      const style = document.createElement('style');
      style.id = 'rrnPasswordManagementStyles';
      style.textContent = `
        .rrn-password-modal{position:fixed;inset:0;z-index:12000;display:grid;place-items:center;padding:20px;background:var(--rrn-overlay,rgba(17,29,46,.58));backdrop-filter:blur(5px)}
        .rrn-password-modal[hidden]{display:none!important}.rrn-password-card{position:relative;width:min(480px,100%);padding:24px;border:1px solid var(--rrn-border,rgba(41,89,145,.16));border-radius:18px;background:var(--rrn-surface,#fff);box-shadow:0 24px 70px rgba(17,29,46,.22);color:var(--rrn-text,#26374f)}
        .rrn-password-close{position:absolute;right:15px;top:13px;width:34px;height:34px;border:0;border-radius:9px;background:color-mix(in srgb,var(--rrn-secondary,#2f7d78) 9%,var(--rrn-surface,#fff));color:var(--rrn-secondary,#2f7d78);font-size:1.35rem;cursor:pointer}
        .rrn-password-head{display:flex;align-items:flex-start;gap:12px;padding-right:34px;margin-bottom:20px}.rrn-password-icon{display:grid;width:42px;height:42px;place-items:center;border-radius:12px;background:color-mix(in srgb,var(--rrn-secondary,#2f7d78) 10%,var(--rrn-surface,#fff));color:var(--rrn-secondary,#2f7d78)}.rrn-password-icon .rrn-icon{width:20px;height:20px}
        .rrn-password-head h2{margin:0;color:var(--rrn-heading,#163a4d);font-size:1.2rem}.rrn-password-head p{margin:5px 0 0;color:var(--rrn-muted,#6c7889);font-size:.75rem;line-height:1.45}
        #passwordChangeForm{display:flex;flex-direction:column;gap:13px}#passwordChangeForm label{display:flex;flex-direction:column;gap:6px;color:var(--rrn-text,#41526a);font-size:.72rem;font-weight:700}
        .rrn-password-field{display:grid;grid-template-columns:1fr auto;overflow:hidden;border:1px solid var(--rrn-border,rgba(41,89,145,.22));border-radius:10px;background:var(--rrn-input,#fff)}.rrn-password-field:focus-within{border-color:var(--rrn-secondary,#2f7d78);box-shadow:0 0 0 3px color-mix(in srgb,var(--rrn-secondary,#2f7d78) 12%,transparent)}
        .rrn-password-field input{min-width:0;height:42px;padding:0 12px;border:0!important;outline:0!important;background:transparent!important;box-shadow:none!important;color:var(--rrn-text,#263238)!important}.rrn-password-field button{padding:0 11px;border:0;background:transparent;color:var(--rrn-secondary,#2f7d78);font-size:.65rem;font-weight:800;cursor:pointer}
        .rrn-password-hint{margin-top:-5px;color:var(--rrn-muted,#7a8494);font-size:.62rem}.rrn-password-message{min-height:18px;margin:0;font-size:.68rem}.rrn-password-message.error{color:var(--rrn-danger,#a62b2b)}.rrn-password-message.success{color:var(--rrn-success,#247046)}
        .rrn-password-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:3px}.rrn-password-actions button{min-height:39px;padding:9px 14px;border-radius:9px;font:inherit;font-size:.7rem;font-weight:800;cursor:pointer}.rrn-password-cancel{border:1px solid var(--rrn-border,rgba(41,89,145,.18));background:var(--rrn-surface-2,#fff);color:var(--rrn-heading,#295991)}.rrn-password-save{border:1px solid var(--rrn-primary,#163a4d);background:var(--rrn-primary,#163a4d);color:#fff}.rrn-password-save:disabled{opacity:.6;cursor:wait}
        @media(max-width:520px){.rrn-password-card{padding:20px 16px}.rrn-password-actions{display:grid;grid-template-columns:1fr 1fr}.rrn-password-actions button{width:100%}}
      `;
      document.head.appendChild(style);
    }

    window.RRN_ICONS?.decorateStatic?.();
  }

  function setMessage(text = '', type = '') {
    const el = document.getElementById('passwordChangeMsg');
    if (!el) return;
    el.textContent = text;
    el.classList.remove('error', 'success');
    if (type) el.classList.add(type);
  }

  function open() {
    injectUI();
    const modal = document.getElementById('passwordChangeModal');
    if (!modal) return;
    document.getElementById('userDropdown')?.setAttribute('hidden', '');
    document.getElementById('passwordChangeForm')?.reset();
    setMessage();
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    setTimeout(() => document.getElementById('currentPassword')?.focus(), 0);
  }

  function close() {
    const modal = document.getElementById('passwordChangeModal');
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    document.getElementById('passwordChangeForm')?.reset();
    setMessage();
  }

  async function submit(event) {
    event.preventDefault();
    const supabaseClient = client();
    if (!supabaseClient) return setMessage('Não foi possível acessar o serviço de autenticação.', 'error');

    const currentPassword = document.getElementById('currentPassword')?.value || '';
    const newPassword = document.getElementById('newPassword')?.value || '';
    const confirmPassword = document.getElementById('confirmNewPassword')?.value || '';
    const button = document.getElementById('passwordChangeButton');

    if (!currentPassword) return setMessage('Informe sua senha atual.', 'error');
    const policyError = passwordPolicyError(newPassword);
    if (policyError) return setMessage(policyError, 'error');
    if (newPassword !== confirmPassword) return setMessage('A confirmação da nova senha não confere.', 'error');
    if (currentPassword === newPassword) return setMessage('Escolha uma senha diferente da atual.', 'error');

    button.disabled = true;
    button.dataset.originalText ||= button.textContent.trim();
    button.textContent = 'Alterando...';
    setMessage();

    try {
      const { error } = await supabaseClient.auth.updateUser({ password: newPassword, current_password: currentPassword });
      if (error) throw error;
      document.getElementById('passwordChangeForm')?.reset();
      setMessage('Senha alterada com sucesso.', 'success');
      setTimeout(close, 1000);
    } catch (error) {
      const message = String(error?.message || '');
      setMessage(/password|credential|invalid/i.test(message)
        ? 'Não foi possível alterar a senha. Confira a senha atual e tente novamente.'
        : (message || 'Não foi possível alterar a senha.'), 'error');
    } finally {
      button.disabled = false;
      button.textContent = button.dataset.originalText || 'Alterar senha';
    }
  }

  function bind() {
    const form = document.getElementById('passwordChangeForm');
    if (form && form.dataset.bound !== '1') {
      form.dataset.bound = '1';
      form.addEventListener('submit', submit);
    }
    document.querySelectorAll('[data-password-target]').forEach(button => {
      if (button.dataset.bound === '1') return;
      button.dataset.bound = '1';
      button.addEventListener('click', () => {
        const input = document.getElementById(button.dataset.passwordTarget);
        if (!input) return;
        input.type = input.type === 'password' ? 'text' : 'password';
        button.textContent = input.type === 'password' ? 'Mostrar' : 'Ocultar';
      });
    });
    const closeButton = document.querySelector('.rrn-password-close');
    if (closeButton && closeButton.dataset.bound !== '1') { closeButton.dataset.bound = '1'; closeButton.addEventListener('click', close); }
    const cancelButton = document.querySelector('.rrn-password-cancel');
    if (cancelButton && cancelButton.dataset.bound !== '1') { cancelButton.dataset.bound = '1'; cancelButton.addEventListener('click', close); }
    const modal = document.getElementById('passwordChangeModal');
    if (modal && modal.dataset.bound !== '1') {
      modal.dataset.bound = '1';
      modal.addEventListener('click', event => { if (event.target === modal) close(); });
    }
  }

  function boot() {
    injectUI();
    bind();
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !document.getElementById('passwordChangeModal')?.hidden) close();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.RRN_PASSWORD_POLICY = Object.freeze({ validate: passwordPolicyError });
  window.openPasswordChangeModal = open;
  window.closePasswordChangeModal = close;
})();