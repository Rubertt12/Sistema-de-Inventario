(() => {
  'use strict';
  if (window.__RRN_LOGIN_PASSWORD_POLICY_V2__) return;
  window.__RRN_LOGIN_PASSWORD_POLICY_V2__ = true;
  if (!/login\.html$/i.test(location.pathname)) return;

  function validate(password) {
    const value = String(password || '');
    if (value.length < 12) return 'Use uma senha com pelo menos 12 caracteres.';
    if (!/[a-z]/.test(value)) return 'Inclua pelo menos uma letra minúscula.';
    if (!/[A-Z]/.test(value)) return 'Inclua pelo menos uma letra maiúscula.';
    if (!/\d/.test(value)) return 'Inclua pelo menos um número.';
    if (!/[^A-Za-z0-9]/.test(value)) return 'Inclua pelo menos um símbolo.';
    return '';
  }

  function messageFor(form) {
    if (form?.id === 'formResetPassword') return document.getElementById('resetPasswordMsg');
    return document.getElementById('registerMsg');
  }

  function applyInputs(root = document) {
    const register = root.querySelector?.('#registerPassword');
    if (register) {
      register.minLength = 12;
      register.placeholder = '12+ caracteres, com número e símbolo';
      register.setAttribute('aria-describedby', 'rrnPasswordPolicyHint');
      if (!document.getElementById('rrnPasswordPolicyHint')) {
        const hint = document.createElement('small');
        hint.id = 'rrnPasswordPolicyHint';
        hint.className = 'rrn-password-policy-hint';
        hint.textContent = 'Use 12+ caracteres com maiúscula, minúscula, número e símbolo.';
        register.closest('.field')?.appendChild(hint);
      }
    }
    root.querySelectorAll?.('#resetPassword,#resetPasswordConfirm').forEach(input => {
      input.minLength = 12;
      input.placeholder = '12+ caracteres';
    });
  }

  document.addEventListener('submit', event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.id !== 'formRegister' && form.id !== 'formResetPassword') return;

    const password = form.id === 'formRegister'
      ? document.getElementById('registerPassword')?.value || ''
      : document.getElementById('resetPassword')?.value || '';
    const error = validate(password);
    if (!error) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    const msg = messageFor(form);
    if (msg) {
      msg.textContent = error;
      msg.classList.remove('success');
      msg.classList.add('error');
    }
    const input = form.id === 'formRegister' ? document.getElementById('registerPassword') : document.getElementById('resetPassword');
    input?.focus();
  }, true);

  const observer = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) applyInputs(node);
      }
    }
  });

  function boot() {
    applyInputs(document);
    observer.observe(document.body, { childList: true, subtree: true });
    if (!document.getElementById('rrnLoginPasswordPolicyStyle')) {
      const style = document.createElement('style');
      style.id = 'rrnLoginPasswordPolicyStyle';
      style.textContent = '.rrn-password-policy-hint{display:block;margin-top:6px;color:var(--rrn-muted,#66757f);font-size:.7rem;line-height:1.45}';
      document.head.appendChild(style);
    }
  }

  window.RRN_LOGIN_PASSWORD_POLICY = Object.freeze({ validate });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
