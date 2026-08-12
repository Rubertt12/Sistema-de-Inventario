(() => {
  'use strict';
  if (window.__RRN_ADMIN_COMPANY_UX_V2__) return;
  window.__RRN_ADMIN_COMPANY_UX_V2__ = true;

  const cfg = window.RRN_SUPABASE || {};
  if (!window.supabase?.createClient || !cfg.url || !cfg.anonKey) return;
  const client = window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let tenants = [];

  function toast(text) {
    const el = $('toast');
    if (!el) return;
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { el.hidden = true; }, 3200);
  }

  function portalUrl(tenant, preview = false) {
    if (!tenant?.slug) return '';
    return `${location.origin}/login.html?org=${encodeURIComponent(tenant.slug)}${preview ? '&preview=1' : ''}`;
  }

  async function copy(text, success) {
    try {
      await navigator.clipboard.writeText(text);
      toast(success);
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
      toast(success);
    }
  }

  async function loadTenants() {
    const { data, error } = await client.from('tenants').select('id,name,slug,status,created_at').order('name', { ascending: true });
    if (error) {
      console.warn('RRN company UX:', error);
      return;
    }
    tenants = data || [];
    syncBrandingSelector();
    enhanceOverviewPortalActions();
    enhanceBrandingPortalAction();
    enhanceCompanyRows();
  }

  function syncBrandingSelector() {
    const select = $('brandingTenantSelector');
    if (!select || !tenants.length) return;
    const main = $('tenantSelector');
    const current = select.value || main?.value || tenants[0].id;
    select.innerHTML = tenants.map(t => `<option value="${t.id}" data-slug="${esc(t.slug || '')}">${esc(t.name || 'Empresa')}${t.status === 'inactive' ? ' · inativa' : ''}</option>`).join('');
    select.value = tenants.some(t => t.id === current) ? current : tenants[0].id;
    select.disabled = false;
    if (!select.dataset.rrnSynced) {
      select.dataset.rrnSynced = '1';
      select.addEventListener('change', () => {
        const target = $('tenantSelector');
        if (target && target.value !== select.value && Array.from(target.options).some(o => o.value === select.value)) {
          target.value = select.value;
          target.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    }
  }

  function currentTenant() {
    const id = $('tenantSelector')?.value || $('brandingTenantSelector')?.value;
    return tenants.find(t => t.id === id) || null;
  }

  function enhanceOverviewPortalActions() {
    const open = $('openLoginButton');
    if (!open) return;
    open.textContent = 'Abrir portal da empresa';
    open.title = 'Abre o login específico da empresa selecionada';
    if (!open.dataset.rrnPortalBound) {
      open.dataset.rrnPortalBound = '1';
      open.addEventListener('click', event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        const url = portalUrl(currentTenant());
        if (!url) return toast('Não foi possível identificar o portal desta empresa.');
        window.open(url, '_blank', 'noopener');
      }, true);
    }
    if (!$('copyPortalUrlButton')) {
      const copyButton = document.createElement('button');
      copyButton.type = 'button';
      copyButton.id = 'copyPortalUrlButton';
      copyButton.className = 'btn-secondary';
      copyButton.textContent = 'Copiar URL do portal';
      copyButton.onclick = () => {
        const url = portalUrl(currentTenant());
        if (!url) return toast('Não foi possível identificar a URL desta empresa.');
        copy(url, 'URL do portal copiada.');
      };
      open.insertAdjacentElement('afterend', copyButton);
    }
  }

  function enhanceBrandingPortalAction() {
    const button = $('openBrandLoginButton');
    if (!button || button.dataset.rrnLoginRouteBound === '1') return;
    button.dataset.rrnLoginRouteBound = '1';
    button.textContent = 'Visualizar portal';
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const id = $('brandingTenantSelector')?.value;
      const tenant = tenants.find(t => t.id === id) || currentTenant();
      const url = portalUrl(tenant, true);
      if (!url) return toast('Não foi possível identificar o portal desta empresa.');
      window.open(url, '_blank', 'noopener,noreferrer');
    }, true);
  }

  function enhanceCompanyRows() {
    const body = $('companiesBody');
    if (!body || !tenants.length) return;
    body.querySelectorAll('[data-select-tenant]').forEach(adminButton => {
      const tenant = tenants.find(t => t.id === adminButton.dataset.selectTenant);
      if (!tenant) return;
      const actions = adminButton.parentElement;
      if (!actions) return;
      if (!actions.querySelector(`[data-open-company-portal="${tenant.id}"]`)) {
        const open = document.createElement('button');
        open.type = 'button';
        open.className = 'action-btn';
        open.dataset.openCompanyPortal = tenant.id;
        open.textContent = 'Abrir portal';
        open.onclick = event => { event.stopPropagation(); window.open(portalUrl(tenant), '_blank', 'noopener'); };
        actions.prepend(open);
      }
      if (!actions.querySelector(`[data-copy-company-portal="${tenant.id}"]`)) {
        const copyButton = document.createElement('button');
        copyButton.type = 'button';
        copyButton.className = 'action-btn';
        copyButton.dataset.copyCompanyPortal = tenant.id;
        copyButton.textContent = 'Copiar URL';
        copyButton.onclick = event => { event.stopPropagation(); copy(portalUrl(tenant), `URL de ${tenant.name || 'empresa'} copiada.`); };
        actions.prepend(copyButton);
      }
    });
  }

  function observeAdminUi() {
    const body = $('companiesBody');
    if (body) {
      const observer = new MutationObserver(() => enhanceCompanyRows());
      observer.observe(body, { childList: true, subtree: true });
    }
    const main = $('tenantSelector');
    if (main) {
      const observer = new MutationObserver(() => {
        syncBrandingSelector();
        enhanceOverviewPortalActions();
        enhanceBrandingPortalAction();
      });
      observer.observe(main, { childList: true });
      main.addEventListener('change', () => {
        const branding = $('brandingTenantSelector');
        if (branding && Array.from(branding.options).some(o => o.value === main.value)) branding.value = main.value;
        enhanceOverviewPortalActions();
        enhanceBrandingPortalAction();
      });
    }
  }

  async function boot() {
    observeAdminUi();
    const { data: { session } } = await client.auth.getSession();
    if (!session?.user) return;
    await loadTenants();
    setTimeout(() => {
      syncBrandingSelector();
      enhanceCompanyRows();
      enhanceOverviewPortalActions();
      enhanceBrandingPortalAction();
    }, 500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();