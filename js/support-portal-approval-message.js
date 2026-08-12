(() => {
  'use strict';
  if (window.__RRN_SUPPORT_APPROVAL_MESSAGE__) return;
  window.__RRN_SUPPORT_APPROVAL_MESSAGE__ = true;

  const cfg = window.RRN_SUPABASE || {};
  const client = window.supabase?.createClient?.(cfg.url, cfg.anonKey, { auth:{persistSession:true,autoRefreshToken:true} });
  if (!client) return;

  function ensureScript(src, marker) {
    if (document.querySelector(`script[${marker}]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.setAttribute(marker, '1');
    document.head.appendChild(script);
  }

  function ensurePortalExtensions() {
    ensureScript('/js/support-collaborator-assets.js', 'data-rrn-support-collaborator-assets');
    ensureScript('/js/service-desk-sla-ui.js', 'data-rrn-service-desk-sla-ui');
  }

  async function sync() {
    try {
      const { data:{session} } = await client.auth.getSession();
      if (!session?.user) return;
      const { data:customer } = await client.from('support_customers').select('status').eq('user_id', session.user.id).maybeSingle();
      if (customer?.status !== 'pending') return;
      const alert = document.getElementById('supportAuthAlert');
      if (!alert) return;
      alert.hidden = false;
      alert.className = 'support-alert';
      alert.textContent = 'Seu cadastro foi recebido e está aguardando aprovação do administrador da empresa. Assim que for liberado, você poderá abrir chamados.';
    } catch (error) {
      console.warn('RRN support approval:', error);
    }
  }

  function boot() {
    ensurePortalExtensions();
    setTimeout(sync, 150);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
  client.auth.onAuthStateChange(() => {
    ensurePortalExtensions();
    setTimeout(sync, 200);
  });
})();