(() => {
  'use strict';
  if (window.__RRN_MFA_GUARD__) return;
  window.__RRN_MFA_GUARD__ = true;

  const path = location.pathname.toLowerCase();
  const publicPages = ['/index.html', '/', '/login.html', '/portal.html', '/seguranca.html'];
  if (publicPages.includes(path)) return;

  const cfg = window.RRN_SUPABASE || {};
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  async function waitClient() {
    for (let i = 0; i < 50; i += 1) {
      if (window.supabase?.createClient && cfg.url && cfg.anonKey) {
        return window.RRN_SUPABASE_CLIENT || window.supabase.createClient(cfg.url, cfg.anonKey, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
        });
      }
      await sleep(100);
    }
    return null;
  }

  async function boot() {
    const client = await waitClient();
    if (!client) return;
    const { data: { session } } = await client.auth.getSession();
    if (!session?.user) return;

    const { data: aal, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !aal) return;
    if (aal.currentLevel === 'aal2') return;

    // Só bloqueia quando a própria conta já possui um segundo fator verificado.
    // Quem ainda não ativou 2FA continua com acesso normal e pode ativar depois.
    if (aal.nextLevel !== 'aal2') return;

    const next = `${location.pathname}${location.search}${location.hash}`;
    location.replace(`/login.html?mfa=required&next=${encodeURIComponent(next)}`);
  }

  boot().catch(error => console.warn('RRN MFA guard:', error));
})();