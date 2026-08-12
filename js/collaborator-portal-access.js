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
    toast.timer = setTimeout(() => { el.hidden = true; }, 5200);
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

  function ensureCredentialModal() {
    if (document.getElementById('rrnTemporaryCredentialsModal')) return;
    const style = document.createElement('style');
    style.textContent = `
      .rrn-temp-credentials{position:fixed;inset:0;z-index:5000;display:grid;place-items:center;padding:20px;background:rgba(8,25,34,.64);backdrop-filter:blur(8px)}
      .rrn-temp-credentials[hidden]{display:none!important}
      .rrn-temp-card{width:min(520px,100%);padding:24px;border-radius:18px;background:#fff;color:#173547;box-shadow:0 28px 80px rgba(0,0,0,.28)}
      .rrn-temp-card h2{margin:4px 0 8px;font-size:1.3rem}.rrn-temp-card p{margin:0 0 18px;color:#60727d;font-size:.86rem;line-height:1.5}
      .rrn-temp-label{display:block;margin:12px 0 6px;font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#60727d}
      .rrn-temp-value{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border:1px solid #dce5e8;border-radius:11px;background:#f7f9fa;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:800;word-break:break-all}
      .rrn-temp-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:20px;flex-wrap:wrap}.rrn-temp-actions button{min-height:40px;padding:0 14px;border-radius:10px;border:1px solid #d5e0e4;background:#fff;font-weight:800;cursor:pointer}.rrn-temp-actions .primary{border-color:#1f716d;background:#1f716d;color:#fff}
      .rrn-temp-warning{margin-top:14px;padding:10px 12px;border-radius:10px;background:#fff7df;color:#765514;font-size:.75rem;font-weight:650}
    `;
    document.head.appendChild(style);

    const modal = document.createElement('div');
    modal.id = 'rrnTemporaryCredentialsModal';
    modal.className = 'rrn-temp-credentials';
    modal.hidden = true;
    modal.innerHTML = `<div class="rrn-temp-card" role="dialog" aria-modal="true" aria-labelledby="rrnTempTitle">
      <small>Acesso inicial ao Portal</small>
      <h2 id="rrnTempTitle">Credenciais temporárias</h2>
      <p>Entregue estas credenciais ao colaborador. No primeiro login ele será obrigado a criar uma nova senha.</p>
      <span class="rrn-temp-label">E-mail</span><div class="rrn-temp-value"><span data-temp-email></span></div>
      <span class="rrn-temp-label">Senha temporária</span><div class="rrn-temp-value"><span data-temp-password></span></div>
      <div class="rrn-temp-warning">Esta senha é exibida somente agora e não é armazenada pelo RRN Manager.</div>
      <div class="rrn-temp-actions"><button type="button" data-copy-temp>Copiar credenciais</button><button type="button" class="primary" data-close-temp>Entendi, fechar</button></div>
    </div>`;
    document.body.appendChild(modal);

    modal.querySelector('[data-close-temp]')?.addEventListener('click', () => {
      modal.hidden = true;
      modal.querySelector('[data-temp-password]').textContent = '';
    });
    modal.querySelector('[data-copy-temp]')?.addEventListener('click', async () => {
      const email = modal.querySelector('[data-temp-email]')?.textContent || '';
      const password = modal.querySelector('[data-temp-password]')?.textContent || '';
      try {
        await navigator.clipboard.writeText(`Portal RRN Manager\nE-mail: ${email}\nSenha temporária: ${password}`);
        toast('Credenciais temporárias copiadas.');
      } catch {
        toast('Não foi possível copiar automaticamente. Selecione as credenciais na tela.');
      }
    });
  }

  function showTemporaryCredentials(email, password) {
    ensureCredentialModal();
    const modal = document.getElementById('rrnTemporaryCredentialsModal');
    modal.querySelector('[data-temp-email]').textContent = email;
    modal.querySelector('[data-temp-password]').textContent = password;
    modal.hidden = false;
  }

  async function edgeErrorMessage(error, data, fallback) {
    if (data?.error) return data.error;
    const response = error?.context;
    if (response && typeof response.clone === 'function') {
      try {
        const body = await response.clone().json();
        if (body?.error) return body.error;
        if (body?.message) return body.message;
      } catch {}
      try {
        const text = await response.clone().text();
        if (text && !/^\s*</.test(text)) return text;
      } catch {}
    }
    return error?.message && error.message !== 'Edge Function returned a non-2xx status code'
      ? error.message
      : fallback;
  }

  function controlHtml(collaborator) {
    const customer = customerFor(collaborator);
    const hasEmail = Boolean(normalizeEmail(collaborator.email));
    const isActiveCollaborator = collaborator.status === 'active';

    if (!hasEmail) {
      return `<div class="collab-portal-control"><span class="badge badge-inactive">Sem e-mail</span><small>Cadastre um e-mail para liberar o portal.</small></div>`;
    }

    if (!isActiveCollaborator) {
      return `<div class="collab-portal-control"><span class="badge badge-inactive">Colaborador inativo</span><small>Ative o colaborador antes de criar ou liberar o acesso ao Portal.</small><button type="button" class="action-btn" disabled>Ative o colaborador primeiro</button></div>`;
    }

    if (collaborator.portal_access || customer?.status === 'active') {
      const temporary = Boolean(customer?.must_change_password);
      const active = customer?.status === 'active';
      const hasAccount = Boolean(collaborator.user_id || customer?.user_id);

      if (!hasAccount) {
        return `<div class="collab-portal-control"><span class="badge badge-pending">Pré-autorizado</span><small>Acesso autorizado, mas a conta ainda não foi criada.</small><button type="button" class="action-btn" data-collab-portal-toggle="${collaborator.id}" data-enabled="true">Criar acesso e gerar senha</button><button type="button" class="action-btn danger" data-collab-portal-toggle="${collaborator.id}" data-enabled="false">Revogar portal</button></div>`;
      }

      const label = temporary ? 'Senha temporária' : active ? 'Portal liberado' : 'Pré-autorizado';
      const hint = temporary
        ? 'Conta criada. O colaborador precisa trocar a senha no primeiro login.'
        : active ? 'Conta vinculada e pronta para entrar.' : 'Acesso autorizado.';
      return `<div class="collab-portal-control"><span class="badge badge-${temporary ? 'pending' : active ? 'active' : 'pending'}">${label}</span><small>${esc(hint)}</small><button type="button" class="action-btn danger" data-collab-portal-toggle="${collaborator.id}" data-enabled="false">Revogar portal</button></div>`;
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
      const customer = customerFor(collaborator);
      const signature = `${collaborator.status}|${collaborator.portal_access}|${collaborator.user_id || ''}|${customer?.status || ''}|${customer?.must_change_password || false}|${collaborator.email || ''}`;
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
        c.from('collaborators').select('id,tenant_id,user_id,name,email,status,portal_access').eq('tenant_id', currentTenant),
        c.from('support_customers').select('id,user_id,tenant_id,name,email,status,must_change_password').eq('tenant_id', currentTenant)
      ]);
      if (collabRes.error) throw collabRes.error;
      if (customerRes.error) throw customerRes.error;
      if (tenantId !== selectedTenantId()) return;

      collaborators.clear(); customersByUser.clear(); customersByEmail.clear();
      (collabRes.data || []).forEach(item => collaborators.set(item.id, item));
      (customerRes.data || []).forEach(item => {
        if (item.user_id) customersByUser.set(item.user_id, item);
        const email = normalizeEmail(item.email); if (email) customersByEmail.set(email, item);
      });
      paint();
    } catch (error) {
      console.warn('RRN collaborator portal access:', error);
    } finally { busy = false; }
  }

  function scheduleRefresh(delay = 60) {
    clearTimeout(refreshTimer); refreshTimer = setTimeout(refresh, delay);
  }

  async function enablePortal(button, collaborator) {
    if (collaborator.status !== 'active') {
      toast('Ative o colaborador antes de criar ou liberar o acesso ao Portal.');
      return;
    }

    button.disabled = true;
    const original = button.textContent;
    button.textContent = 'Criando acesso...';
    const { data, error } = await client.functions.invoke('portal-user-access', {
      body: { action: 'provision', collaborator_id: collaborator.id }
    });
    if (error || data?.error) {
      button.disabled = false;
      button.textContent = original || 'Liberar portal';
      toast(await edgeErrorMessage(error, data, 'Não foi possível criar o acesso ao Portal.'));
      return;
    }

    if (data?.created && data?.temporary_password) {
      showTemporaryCredentials(data.email || collaborator.email, data.temporary_password);
      toast(`Conta do Portal criada para ${collaborator.name}.`);
    } else {
      toast(data?.message || `Acesso ao Portal liberado para ${collaborator.name}.`);
    }
    await refresh();
  }

  async function revokePortal(button, collaborator) {
    button.disabled = true;
    button.textContent = 'Revogando...';
    const { data, error } = await client.rpc('admin_set_collaborator_portal_access', {
      p_collaborator_id: collaborator.id,
      p_enabled: false
    });
    if (error) {
      button.disabled = false;
      button.textContent = 'Revogar portal';
      toast(error.message || 'Não foi possível revogar o acesso.');
      return;
    }
    toast(`Acesso ao Portal revogado para ${collaborator.name}.`);
    await refresh();
  }

  async function togglePortal(button) {
    if (!client || button.disabled) return;
    const id = button.dataset.collabPortalToggle;
    const enabled = button.dataset.enabled === 'true';
    const collaborator = collaborators.get(id);
    if (!collaborator) return;
    if (enabled) return enablePortal(button, collaborator);
    return revokePortal(button, collaborator);
  }

  function bind() {
    ensureCredentialModal();
    document.addEventListener('click', event => {
      const button = event.target.closest('[data-collab-portal-toggle]');
      if (button) { event.preventDefault(); return togglePortal(button); }
      if (event.target.closest('[data-view="collaborators"]')) scheduleRefresh(120);
    });
    document.getElementById('tenantSelector')?.addEventListener('change', () => scheduleRefresh(100));
    const root = document.querySelector('.admin-content') || document.body;
    if (root) new MutationObserver(() => {
      if (document.getElementById('collaboratorsBody')) {
        paint();
        if (!collaborators.size || tenantId !== selectedTenantId()) scheduleRefresh(100);
      }
    }).observe(root, { childList: true, subtree: true });
  }

  async function boot() { await ensureClient(); bind(); scheduleRefresh(120); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
