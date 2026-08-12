(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  if (params.get('preview') !== '1') return;
  if (!window.supabase?.createClient || window.__RRN_AUTH_PREVIEW_BRIDGE__) return;
  window.__RRN_AUTH_PREVIEW_BRIDGE__ = true;
  window.RRN_AUTH_PREVIEW_MODE = true;

  const originalCreateClient = window.supabase.createClient.bind(window.supabase);
  window.supabase.createClient = function(url, key, options = {}) {
    return originalCreateClient(url, key, {
      ...options,
      auth: {
        ...(options.auth || {}),
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });
  };

  function mountPreviewState() {
    document.documentElement.dataset.authPreview = '1';
    const card = document.getElementById('authCard');
    if (!card || document.getElementById('rrnLoginPreviewNotice')) return;

    const notice = document.createElement('div');
    notice.id = 'rrnLoginPreviewNotice';
    notice.setAttribute('role', 'status');
    notice.style.cssText = 'margin:0 0 14px;padding:10px 12px;border:1px solid var(--rrn-border,rgba(22,58,77,.18));border-radius:10px;background:var(--rrn-surface-soft,#f2f6f6);color:var(--rrn-text,#263238);font-size:.72rem;line-height:1.45';
    notice.textContent = 'Pré-visualização do login da empresa. Sua sessão administrativa atual não será utilizada nem alterada.';
    const header = card.querySelector('.auth-header');
    header?.insertAdjacentElement('afterend', notice);

    const loginForm = document.getElementById('formLogin');
    if (loginForm) {
      loginForm.addEventListener('submit', event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        const msg = document.getElementById('loginMsg');
        if (msg) {
          msg.textContent = 'Esta janela é somente uma pré-visualização. Abra o endereço normal da empresa para autenticar.';
          msg.classList.remove('success');
          msg.classList.add('error');
        }
      }, true);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountPreviewState, { once: true });
  else mountPreviewState();
})();