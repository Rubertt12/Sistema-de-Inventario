(() => {
  'use strict';
  if (window.__RRN_ADMIN_TENANT_DELETE__) return;
  window.__RRN_ADMIN_TENANT_DELETE__ = true;

  const cfg = window.RRN_SUPABASE || {};
  if (!cfg.url || !cfg.anonKey || !window.supabase?.createClient) return;

  const client = window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const state = {
    ready: false,
    platformAdmin: false,
    currentTenantId: null,
    busy: false,
    observer: null
  };

  const $ = id => document.getElementById(id);

  function showToast(message, isError = false) {
    const el = $('toast');
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    el.dataset.type = isError ? 'error' : 'success';
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => { el.hidden = true; }, 4200);
  }

  async function edgeErrorMessage(error) {
    let message = error?.message || 'Não foi possível excluir a empresa.';
    const response = error?.context;
    if (response && typeof response.clone === 'function') {
      try {
        const payload = await response.clone().json();
        if (payload?.error) message = String(payload.error);
      } catch {
        try {
          const text = await response.clone().text();
          if (text) message = text;
        } catch {}
      }
    }
    return message;
  }

  function ensureWarning() {
    const panel = document.querySelector('[data-view-panel="companies"] .panel');
    if (!panel || panel.querySelector('[data-tenant-delete-warning]')) return;
    const warning = document.createElement('div');
    warning.dataset.tenantDeleteWarning = '1';
    warning.className = 'notice';
    warning.style.marginBottom = '16px';
    warning.innerHTML = '<strong>Exclusão permanente:</strong> remove inventário, chamados, colaboradores, configurações, branding, convites e acessos vinculados à empresa. A empresa da sessão atual fica protegida.';
    panel.prepend(warning);
  }

  async function fetchTenant(tenantId) {
    const { data, error } = await client.from('tenants')
      .select('id,name,slug,status')
      .eq('id', tenantId)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function deleteTenant(tenantId, button) {
    if (state.busy || !tenantId) return;
    if (tenantId === state.currentTenantId) {
      showToast('A empresa da sua sessão atual está protegida contra exclusão.', true);
      return;
    }

    let tenant;
    try {
      tenant = await fetchTenant(tenantId);
    } catch (error) {
      showToast(error.message || 'Falha ao carregar a empresa.', true);
      return;
    }
    if (!tenant) return showToast('Empresa não encontrada.', true);

    const accepted = confirm(`Excluir permanentemente a empresa "${tenant.name}"?\n\nSerão removidos os dados do inventário, chamados, colaboradores, configurações e acessos vinculados. Esta ação não pode ser desfeita.`);
    if (!accepted) return;

    const typed = prompt(`Para confirmar, digite exatamente o nome da empresa:\n\n${tenant.name}`);
    if (typed === null) return;
    if (typed.trim() !== String(tenant.name || '').trim()) {
      showToast('Nome de confirmação incorreto. Nada foi excluído.', true);
      return;
    }

    state.busy = true;
    const original = button?.textContent || 'Excluir';
    if (button) {
      button.disabled = true;
      button.textContent = 'Excluindo...';
    }

    try {
      const { data, error } = await client.functions.invoke('tenant-admin', {
        body: {
          action: 'delete_tenant',
          tenant_id: tenant.id,
          confirmation_name: typed.trim()
        }
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'A exclusão não foi concluída.');

      if (Array.isArray(data.auth_delete_failures) && data.auth_delete_failures.length) {
        showToast(`Empresa excluída. ${data.auth_delete_failures.length} conta(s) Auth precisam de revisão manual.`, true);
      } else {
        showToast(`Empresa ${tenant.name} excluída permanentemente.`);
      }

      setTimeout(() => location.reload(), 700);
    } catch (error) {
      showToast(await edgeErrorMessage(error), true);
      if (button) {
        button.disabled = false;
        button.textContent = original;
      }
    } finally {
      state.busy = false;
    }
  }

  function paintButtons() {
    if (!state.ready || !state.platformAdmin) return;
    ensureWarning();
    document.querySelectorAll('#companiesBody [data-select-tenant]').forEach(adminButton => {
      const tenantId = adminButton.dataset.selectTenant;
      const actions = adminButton.parentElement;
      if (!actions || actions.querySelector(`[data-delete-tenant="${tenantId}"]`)) return;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'action-btn danger';
      button.dataset.deleteTenant = tenantId;
      button.textContent = tenantId === state.currentTenantId ? 'Protegida' : 'Excluir';
      button.disabled = tenantId === state.currentTenantId;
      button.title = tenantId === state.currentTenantId
        ? 'A empresa da sessão atual não pode ser excluída.'
        : 'Excluir empresa permanentemente';
      button.addEventListener('click', () => deleteTenant(tenantId, button));
      actions.appendChild(button);
    });
  }

  async function boot() {
    const { data: { session } } = await client.auth.getSession();
    if (!session?.user) return;

    const [{ data: profile, error: profileError }, { data: platform, error: platformError }] = await Promise.all([
      client.from('profiles').select('user_id,tenant_id,role,status').eq('user_id', session.user.id).maybeSingle(),
      client.rpc('is_platform_admin')
    ]);

    if (profileError || platformError || !profile || profile.status !== 'active') return;
    state.currentTenantId = profile.tenant_id;
    state.platformAdmin = Boolean(platform);
    state.ready = true;
    if (!state.platformAdmin) return;

    paintButtons();
    const body = $('companiesBody');
    if (body) {
      state.observer = new MutationObserver(paintButtons);
      state.observer.observe(body, { childList: true });
    }
  }

  window.addEventListener('beforeunload', () => state.observer?.disconnect(), { once: true });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();