(() => {
  'use strict';
  if (window.__RRN_SUPPORT_PRESENCE__) return;
  window.__RRN_SUPPORT_PRESENCE__ = true;

  const cfg = window.RRN_SUPABASE || {};
  if (!cfg.url || !cfg.anonKey || !window.supabase?.createClient) return;

  const client = window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true }
  });

  let timer = null;

  async function heartbeat() {
    if (document.hidden) return;
    try {
      const { data: { session } } = await client.auth.getSession();
      if (!session?.user) return;
      const { error } = await client.rpc('support_staff_heartbeat');
      if (error) console.warn('RRN support presence:', error.message || error);
    } catch (error) {
      console.warn('RRN support presence:', error);
    }
  }

  function start() {
    heartbeat();
    clearInterval(timer);
    timer = setInterval(heartbeat, 30000);
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) heartbeat();
  });
  window.addEventListener('focus', heartbeat);
  window.addEventListener('beforeunload', () => clearInterval(timer), { once: true });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();