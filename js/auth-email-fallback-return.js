(() => {
  'use strict';

  const PENDING_KEY = 'rrn_email_magic_fallback_pending';
  const $ = id => document.getElementById(id);
  const cfg = window.RRN_SUPABASE || {};
  const callbackHash = location.hash || '';
  const callbackParams = new URLSearchParams(callbackHash.replace(/^#/, ''));
  const callbackType = callbackParams.get('type');
  const isMagicLinkCallback = ['magiclink', 'email'].includes(callbackType) && Boolean(callbackParams.get('access_token'));

  function setStatus(title, text, type = '') {
    if ($('fallbackTitle')) $('fallbackTitle').textContent = title;
    if ($('fallbackText')) $('fallbackText').textContent = text;
    const card = $('fallbackCard');
    if (card) {
      card.classList.remove('is-error', 'is-success');
      if (type) card.classList.add(type === 'error' ? 'is-error' : 'is-success');
    }
  }

  function safeRedirect(raw) {
    return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/dashboard.html';
  }

  function loadPending() {
    try {
      return JSON.parse(localStorage.getItem(PENDING_KEY) || 'null');
    } catch {
      return null;
    }
  }

  function saveCompat(profile) {
    localStorage.setItem('usuarioLogado', JSON.stringify({
      id: profile.user_id,
      nome: profile.name || profile.email || 'Usuário',
      email: profile.email || '',
      perfil: profile.role || 'monitoramento',
      tenant_id: profile.tenant_id,
      tenant: profile.tenants?.name || 'Workspace'
    }));
  }

  async function waitForUser(client, attempts = 40) {
    let lastError = null;
    for (let i = 0; i < attempts; i += 1) {
      const { data, error } = await client.auth.getUser();
      if (!error && data?.user) return data.user;
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, 125));
    }
    throw lastError || new Error('Não foi possível validar o link de acesso.');
  }

  async function run() {
    if (!isMagicLinkCallback) {
      setStatus('Link inválido', 'Abra novamente o botão “Entrar” recebido por e-mail.', 'error');
      return;
    }

    const pending = loadPending();
    if (!pending) {
      setStatus('Solicitação não encontrada', 'Volte ao login, informe sua senha novamente e solicite outro link por e-mail.', 'error');
      return;
    }

    if (!pending.expiresAt || Date.now() > Number(pending.expiresAt)) {
      localStorage.removeItem(PENDING_KEY);
      setStatus('Solicitação expirada', 'Volte ao login e solicite um novo link por e-mail.', 'error');
      return;
    }

    if (!/^https:\/\/.+\.supabase\.co$/i.test(cfg.url || '') || !cfg.anonKey || !window.supabase?.createClient) {
      setStatus('Serviço indisponível', 'A configuração de autenticação não foi carregada.', 'error');
      return;
    }

    const client = window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });

    try {
      setStatus('Validando seu acesso', 'Aguarde enquanto confirmamos o link recebido por e-mail.');
      const user = await waitForUser(client);
      if (!pending.userId || user.id !== pending.userId) {
        await client.auth.signOut({ scope: 'local' }).catch(() => undefined);
        throw new Error('O link foi validado para uma conta diferente daquela que iniciou o login.');
      }

      const { data: profile, error } = await client
        .from('profiles')
        .select('user_id,tenant_id,name,email,role,status,tenants(name,slug,status)')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      if (!profile || profile.status !== 'active') throw new Error('Seu acesso está inativo.');

      const requestedSlug = String(pending.requestedSlug || '').toLowerCase();
      if (requestedSlug) {
        const profileSlug = String(profile?.tenants?.slug || '').toLowerCase();
        if (profileSlug !== requestedSlug || profile?.tenants?.status === 'inactive') {
          await client.auth.signOut({ scope: 'local' }).catch(() => undefined);
          throw new Error('Esta conta não pertence a este ambiente.');
        }
      }

      saveCompat(profile);
      sessionStorage.setItem('rrn_email_fallback_verified', new Date().toISOString());
      sessionStorage.removeItem('rrn_hydrated_tenant');
      localStorage.removeItem(PENDING_KEY);

      setStatus('Acesso confirmado', 'E-mail validado. Entrando no RRN Manager...', 'success');
      setTimeout(() => location.replace(safeRedirect(pending.redirectTarget)), 350);
    } catch (error) {
      setStatus('Não foi possível confirmar', error?.message || 'O link é inválido ou expirou. Solicite um novo acesso por e-mail.', 'error');
    }
  }

  run();
})();