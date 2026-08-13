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

    const [{ data: profile }, { data: aal, error: aalError }] = await Promise.all([
      client.from('profiles').select('user_id,tenant_id,role,status').eq('user_id', session.user.id).maybeSingle(),
      client.auth.mfa.getAuthenticatorAssuranceLevel()
    ]);
    if (aalError || !profile || profile.status !== 'active') return;
    if (aal?.currentLevel === 'aal2') return;

    let required = ['admin', 'monitoramento'].includes(profile.role) || aal?.nextLevel === 'aal2';
    if (!required) {
      const { data: staff } = await client.from('support_staff')
        .select('id').eq('user_id', session.user.id).eq('tenant_id', profile.tenant_id).eq('status', 'active').maybeSingle();
      required = Boolean(staff?.id);
    }
    if (!required) return;

    const next = `${location.pathname}${location.search}${location.hash}`;
    location.replace(`/login.html?mfa=required&next=${encodeURIComponent(next)}`);
  }

  boot().catch(error => console.warn('RRN MFA guard:', error));
})();