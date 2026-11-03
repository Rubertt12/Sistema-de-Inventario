(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const cfg = window.RRN_SUPABASE || {};
  const configured = /^https:\/\/.+\.supabase\.co$/i.test(cfg.url || '') && Boolean(cfg.anonKey);
  const params = new URLSearchParams(location.search);
  const hash = new URLSearchParams((location.hash || '').replace(/^#/, ''));
  const recoveryHint = params.get('type') === 'recovery' || hash.get('type') === 'recovery';
  const client = configured && window.supabase?.createClient
    ? (window.RRN_SUPABASE_CLIENT || window.supabase.createClient(cfg.url, cfg.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      }))
    : null;
  if (client) window.RRN_SUPABASE_CLIENT = client;

  function message(id, text = '', type = '') {
    const el = $(id);
    if (!el) return;
    el.textContent = text;
    el.className = 'message' + (type ? ' ' + type : '');
  }
  function busy(button, state, label) {
    if (!button) return;
    if (!button.dataset.original) button.dataset.original = button.textContent;
    button.disabled = state;
    button.textContent = state ? label : button.dataset.original;
  }
  function show(panel) {
    ['requestPanel','resetPanel','donePanel'].forEach(id => $(id).hidden = id !== panel);
    $('backLink').hidden = panel === 'donePanel';
  }
  function explainError(error) {
    const raw = String(error?.message || '');
    if (/expired|invalid.*token|token.*invalid|otp_expired/i.test(raw)) return 'Este link expirou ou já foi utilizado. Solicite um novo link de recuperação.';
    if (/password.*(weak|short)|weak.*password/i.test(raw)) return 'A senha não atende aos requisitos de segurança. Use uma senha mais forte.';
    return raw || 'Não foi possível concluir a operação. Tente novamente.';
  }

  document.querySelectorAll('[data-toggle]').forEach(button => button.addEventListener('click', () => {
    const input = $(button.dataset.toggle);
    input.type = input.type === 'password' ? 'text' : 'password';
    button.textContent = input.type === 'password' ? 'Mostrar' : 'Ocultar';
  }));

  const emailFromQuery = params.get('email');
  if (emailFromQuery && $('email')) $('email').value = emailFromQuery;

  if (!client) {
    show('requestPanel');
    message('requestMessage', 'Não foi possível conectar ao serviço de autenticação. Atualize a página ou tente novamente mais tarde.', 'error');
    $('sendButton').disabled = true;
    return;
  }

  $('requestForm').addEventListener('submit', async event => {
    event.preventDefault();
    const email = $('email').value.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      message('requestMessage', 'Informe um endereço de e-mail válido.', 'error');
      return;
    }
    busy($('sendButton'), true, 'Enviando...');
    message('requestMessage');
    try {
      const redirectTo = new URL('https://rrnmanager.vercel.app/recuperar-senha.html');
      redirectTo.searchParams.set('type', 'recovery');
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: redirectTo.toString() });
      if (error) throw error;
      message('requestMessage', 'Se este e-mail estiver cadastrado, você receberá uma mensagem com o link de recuperação. Confira também o spam.', 'success');
    } catch (error) {
      message('requestMessage', explainError(error), 'error');
    } finally {
      busy($('sendButton'), false);
    }
  });

  $('resetForm').addEventListener('submit', async event => {
    event.preventDefault();
    const password = $('newPassword').value;
    const confirmation = $('confirmPassword').value;
    if (password.length < 12) return message('resetMessage', 'Use uma senha com pelo menos 12 caracteres.', 'error');
    if (password !== confirmation) return message('resetMessage', 'As senhas não conferem.', 'error');
    busy($('saveButton'), true, 'Salvando...');
    message('resetMessage');
    try {
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      await client.auth.signOut({ scope: 'local' });
      history.replaceState(null, '', '/recuperar-senha.html?concluido=1');
      show('donePanel');
    } catch (error) {
      message('resetMessage', explainError(error), 'error');
    } finally {
      busy($('saveButton'), false);
    }
  });

  let recoveryEvent = false;
  client.auth.onAuthStateChange(event => {
    if (event === 'PASSWORD_RECOVERY') {
      recoveryEvent = true;
      show('resetPanel');
      message('resetMessage', 'Link validado. Defina sua nova senha.', 'success');
    }
  });

  (async () => {
    if (params.get('concluido') === '1') {
      show('donePanel');
      return;
    }
    try {
      // O SDK processa o callback PKCE/hash ao inicializar o cliente.
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      if (recoveryHint || recoveryEvent) {
        if (data.session?.user || recoveryEvent) {
          show('resetPanel');
          message('resetMessage', 'Link validado. Defina sua nova senha.', 'success');
        } else {
          show('requestPanel');
          message('requestMessage', 'Não foi possível validar este link. Ele pode ter expirado ou já ter sido usado. Solicite outro abaixo.', 'error');
        }
        return;
      }
      show('requestPanel');
    } catch (error) {
      show('requestPanel');
      message('requestMessage', explainError(error), 'error');
    }
  })();
})();