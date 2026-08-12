(() => {
  'use strict';
  if (window.__RRN_COLLABORATOR_PORTAL_ACCESS__) return;
  window.__RRN_COLLABORATOR_PORTAL_ACCESS__ = true;

  const cfg = window.RRN_SUPABASE || {};
  let client = null;
  let tenantId = null;
  let busy = false;
  let refreshTimer = null;
  const collaborators = new Map();
  const customersByUser = new Map();
  const customersByEmail = new Map();

  const normalizeEmail = value => String(value || '').trim().toLowerCase();
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function toast(message) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { el.hidden = true; }, 3800);
  }

  async function ensureClient() {
    if (client) return client;
    for (let i = 0; i < 50; i += 1) {
      if (window.supabase?.createClient && cfg.url && cfg.anonKey) {
        client = window.supabase.createClient(cfg.url, cfg.anonKey, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
        });
        return client;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return null;
  }

  function selectedTenantId() {
    return document.getElementById('tenantSelector')?.value || window.RRN_SESSION?.tenantId || null;
  }

  function customerFor(collaborator) {
    if (!collaborator) return null;
    if (collaborator.user_id && customersByUser.has(collaborator.user_id)) return customersByUser.get(collaborator.user_id);
    const email = normalizeEmail(collaborator.email);
    return email ? customersByEmail.get(email) || null : null;
  }

  function controlHtml(collaborator) {
    const customer = customerFor(collaborator);
    const hasEmail = Boolean(normalizeEmail(collaborator.email));

    if (!hasEmail) {
      return `<div class="collab-portal-control"><span class="badge badge-inactive">Sem e-mail</span><small>Cadastre um e-mail para liberar o portal.</small></div>`;
    }

    if (collaborator.portal_access) {
      const active = customer?.status === 'active';
      const label = active ? 'Portal liberado' : 'Pré-autorizado';
      const hint = active
        ? 'Conta já vinculada e pronta para entrar.'
        : 'No primeiro acesso com este e-mail, o portal será ativado automaticamente.';
      return `<div class="collab-portal-control"><span class="badge badge-${active ? 'active' : 'pending'}">${label}</span><small>${esc(hint)}</small><button type="button" class="action-btn danger" data-collab-portal-toggle="${collaborator.id}" data-enabled="false">Revogar portal</button></div>`;
    }

    const blocked = customer?.status === 'blocked';
    const label = blocked ? 'Bloqueado' : customer?.status === 'pending' ? 'Aguardando aprovação' : 'Sem acesso';
    return `<div class="collab-portal-control"><span class="badge badge-${customer?.status === 'pending' ? 'pending' : 'inactive'}">${esc(label)}</span><button type="button" class="action-btn" data-collab-portal-toggle="${collaborator.id}" data-enabled="true">Liberar portal</button></div>`;
  }

  function paint() {
    document.querySelectorAll('#collaboratorsBody tr').forEach(row => {
      const identity = row.querySelector('[data-collab-edit]');
      const id = identity?.dataset.collabEdit;
      const collaborator = collaborators.get(id);
      if (!collaborator) return;
      const cell = row.children?.[2];
      if (!cell) return;
      const signature = `${collaborator.portal_access}|${collaborator.user_id || ''}|${customerFor(collaborator)?.status || ''}|${collaborator.email || ''}`;
      if (cell.dataset.portalAccessSignature === signature) return;
      cell.dataset.portalAccessSignature = signature;
      cell.innerHTML = controlHtml(collaborator);
    });
  }

  async function refresh() {
    const c = await ensureClient();
    const currentTenant = selectedTenantId();
    if (!c || !currentTenant || busy) return;
    busy = true;
    tenantId = currentTenant;
    try {
      const [collabRes, customerRes] = await Promise.all([
        c.from('collaborators')
          .select('id,tenant_id,user_id,name,email,status,portal_access')
          .eq('tenant_id', currentTenant),
        c.from('support_customers')
          .select('id,user_id,tenant_id,name,email,status')
          .eq('tenant_id', currentTenant)
      ]);
      if (collabRes.error) throw collabRes.error;
      if (customerRes.error) throw customerRes.error;
      if (tenantId !== selectedTenantId()) return;

      collaborators.clear();
      customersByUser.clear();
      customersByEmail.clear();
      (collabRes.data || []).forEach(item => collaborators.set(item.id, item));
      (customerRes.data || []).forEach(item => {
        if (item.user_id) customersByUser.set(item.user_id, item);
        const email = normalizeEmail(item.email);
        if (email) customersByEmail.set(email, item);
      });
      paint();
    } catch (error) {
      console.warn('RRN collaborator portal access:', error);
    } finally {
      busy = false;
    }
  }

  function scheduleRefresh(delay = 60) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, delay);
  }

  async function togglePortal(button) {
    if (!client || button.disabled) return;
    const id = button.dataset.collabPortalToggle;
    const enabled = button.dataset.enabled === 'true';
    const collaborator = collaborators.get(id);
    if (!collaborator) return;

    button.disabled = true;
    button.textContent = enabled ? 'Liberando...' : 'Revogando...';
    const { data, error } = await client.rpc('admin_set_collaborator_portal_access', {
      p_collaborator_id: id,
      p_enabled: enabled
    });

    if (error) {
      button.disabled = false;
      button.textContent = enabled ? 'Liberar portal' : 'Revogar portal';
      toast(error.message || 'Não foi possível alterar o acesso ao portal.');
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;
    if (enabled && result?.portal_status === 'preapproved') {
      toast(`Portal pré-autorizado para ${collaborator.name}. No primeiro acesso, use ${collaborator.email}.`);
    } else {
      toast(enabled ? `Acesso ao Portal liberado para ${collaborator.name}.` : `Acesso ao Portal revogado para ${collaborator.name}.`);
    }
    await refresh();
  }

  function bind() {
    document.addEventListener('click', event => {
      const button = event.target.closest('[data-collab-portal-toggle]');
      if (button) {
        event.preventDefault();
        return togglePortal(button);
      }
      if (event.target.closest('[data-view="collaborators"]')) scheduleRefresh(120);
    });

    document.getElementById('tenantSelector')?.addEventListener('change', () => scheduleRefresh(100));

    const root = document.querySelector('.admin-content') || document.body;
    if (root) {
      new MutationObserver(() => {
        if (document.getElementById('collaboratorsBody')) {
          paint();
          if (!collaborators.size || tenantId !== selectedTenantId()) scheduleRefresh(100);
        }
      }).observe(root, { childList: true, subtree: true });
    }
  }

  async function boot() {
    await ensureClient();
    bind();
    scheduleRefresh(120);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
