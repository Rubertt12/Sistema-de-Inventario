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

  function setMessage(text = '', type = '') {
    const el = document.getElementById('passwordChangeMsg');
    if (!el) return;
    el.textContent = text;
    el.classList.remove('error', 'success');
    if (type) el.classList.add(type);
  }

  function open() {
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

    if (currentPassword.length < 1) return setMessage('Informe sua senha atual.', 'error');
    if (newPassword.length < 8) return setMessage('A nova senha deve ter pelo menos 8 caracteres.', 'error');
    if (newPassword !== confirmPassword) return setMessage('A confirmação da nova senha não confere.', 'error');
    if (currentPassword === newPassword) return setMessage('Escolha uma senha diferente da atual.', 'error');

    button.disabled = true;
    button.dataset.originalText ||= button.textContent.trim();
    button.textContent = 'Alterando...';
    setMessage();

    try {
      const { error } = await supabaseClient.auth.updateUser({
        password: newPassword,
        currentPassword
      });
      if (error) throw error;
      document.getElementById('passwordChangeForm')?.reset();
      setMessage('Senha alterada com sucesso.', 'success');
      setTimeout(close, 900);
    } catch (error) {
      const message = String(error?.message || '');
      setMessage(
        /password|credential|invalid/i.test(message)
          ? 'Não foi possível alterar a senha. Confira a senha atual e tente novamente.'
          : (message || 'Não foi possível alterar a senha.'),
        'error'
      );
    } finally {
      button.disabled = false;
      button.textContent = button.dataset.originalText || 'Alterar senha';
    }
  }

  function togglePassword(event) {
    const button = event.currentTarget;
    const id = button.dataset.passwordTarget;
    const input = document.getElementById(id);
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    button.textContent = input.type === 'password' ? 'Mostrar' : 'Ocultar';
  }

  function boot() {
    document.getElementById('passwordChangeForm')?.addEventListener('submit', submit);
    document.querySelectorAll('[data-password-target]').forEach(button => {
      button.addEventListener('click', togglePassword);
    });
    document.getElementById('passwordChangeModal')?.addEventListener('click', event => {
      if (event.target.id === 'passwordChangeModal') close();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !document.getElementById('passwordChangeModal')?.hidden) close();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.openPasswordChangeModal = open;
  window.closePasswordChangeModal = close;
})();