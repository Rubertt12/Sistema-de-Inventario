(() => {
  'use strict';
  if (window.__RRN_SUPPORT_APPROVAL_MESSAGE__) return;
  window.__RRN_SUPPORT_APPROVAL_MESSAGE__ = true;
  const cfg = window.RRN_SUPABASE || {};
  const client = window.supabase?.createClient?.(cfg.url, cfg.anonKey, { auth:{persistSession:true,autoRefreshToken:true} });
  if (!client) return;

  function loadCollaboratorAssets() {
    if (document.querySelector('script[data-rrn-support-collaborator-assets]')) return;
    const script = document.createElement('script');
    script.src = '/js/support-collaborator-assets.js';
    script.async = false;
    script.dataset.rrnSupportCollaboratorAssets = '1';
    document.head.appendChild(script);
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

  loadCollaboratorAssets();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(sync, 150), { once:true });
  else setTimeout(sync, 150);
  client.auth.onAuthStateChange(() => setTimeout(sync, 200));
})();
