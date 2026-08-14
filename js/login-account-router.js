(() => {
  'use strict';
  if (window.__RRN_LOGIN_ACCOUNT_ROUTER__) return;
  window.__RRN_LOGIN_ACCOUNT_ROUTER__ = true;

  const getClient = () => window.RRN_SUPABASE_CLIENT;
  let routing = false;

  async function routeSupportAccount(session) {
    if (routing || !session?.user?.id) return false;
    const client = getClient();
    if (!client) return false;

    routing = true;
    try {
      const userId = session.user.id;

      const { data: profile, error: profileError } = await client
        .from('profiles')
        .select('user_id,status')
        .eq('user_id', userId)
        .maybeSingle();

      if (!profileError && profile) return false;

      const { data: customer, error: customerError } = await client
        .from('support_customers')
        .select('id,user_id,status')
        .eq('user_id', userId)
        .maybeSingle();

      if (customerError || !customer || customer.status !== 'active') return false;

      const msg = document.getElementById('loginMsg');
      if (msg) {
        msg.textContent = 'Conta do Portal de Suporte identificada. Redirecionando...';
        msg.classList.remove('error');
        msg.classList.add('success');
      }

      location.replace('/portal.html');
      return true;
    } catch (error) {
      console.warn('RRN login router:', error);
      return false;
    } finally {
      routing = false;
    }
  }

  function boot() {
    const client = getClient();
    if (!client) {
      setTimeout(boot, 100);
      return;
    }

    client.auth.getSession().then(({ data }) => routeSupportAccount(data?.session)).catch(() => undefined);

    client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setTimeout(() => routeSupportAccount(session), 0);
      }
    });
  }

  boot();
})();
