(() => {
  'use strict';
  if (window.__RRN_SUPPORT_DESK_LINK__) return;
  window.__RRN_SUPPORT_DESK_LINK__ = true;

  const cfg = window.RRN_SUPABASE || {};
  const client = window.supabase?.createClient?.(cfg.url, cfg.anonKey, { auth: { persistSession: true, autoRefreshToken: true } });
  let allowed = false;
  let checked = false;

  async function resolveAccess() {
    if (!client) { checked = true; return; }
    try {
      const { data: { session } } = await client.auth.getSession();
      if (!session?.user) { checked = true; return; }
      const { data: profile } = await client.from('profiles').select('user_id,tenant_id,status').eq('user_id', session.user.id).maybeSingle();
      if (!profile || profile.status !== 'active') { checked = true; return; }
      const { data: staff } = await client.from('support_staff').select('id').eq('user_id', session.user.id).eq('tenant_id', profile.tenant_id).eq('status', 'active').maybeSingle();
      allowed = !!staff;
    } catch (error) {
      console.warn('RRN support desk access:', error);
    } finally {
      checked = true;
      sync();
    }
  }

  function removeLinks() {
    document.querySelectorAll('[data-support-desk-link]').forEach(el => el.remove());
  }

  function mount() {
    if (!allowed) return removeLinks();
    const actions = document.querySelector('.dashboard-actions');
    if (actions && !actions.querySelector('[data-support-desk-link]')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.supportDeskLink = '1';
      button.textContent = '🎫 Central de Chamados';
      button.addEventListener('click', () => location.href = '/chamados.html');
      actions.appendChild(button);
    }
    const dropdown = document.getElementById('userDropdown');
    if (dropdown && !dropdown.querySelector('[data-support-desk-link]')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.supportDeskLink = '1';
      button.textContent = '🎫 Central de Chamados';
      button.addEventListener('click', event => { event.stopPropagation(); location.href = '/chamados.html'; });
      const config = dropdown.querySelector('button[onclick*="openConfigModal"]');
      dropdown.insertBefore(button, config || dropdown.firstChild);
    }
  }

  function sync() {
    if (!checked || !allowed) return removeLinks();
    mount();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', resolveAccess, { once: true });
  else resolveAccess();
  new MutationObserver(sync).observe(document.documentElement, { childList: true, subtree: true });
})();