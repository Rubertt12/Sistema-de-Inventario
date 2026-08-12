(() => {
  'use strict';
  if (window.__RRN_ADMIN_USER_DELETE__) return;
  window.__RRN_ADMIN_USER_DELETE__ = true;

  const cfg = window.RRN_SUPABASE || {};
  let client = null;
  let currentUserId = null;
  let observer = null;
  let painting = false;

  const $ = (id) => document.getElementById(id);

  function toast(message) {
    const el = $('toast');
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { el.hidden = true; }, 4200);
  }

  async function ensureClient() {
    if (client) return client;
    for (let i = 0; i < 50; i += 1) {
      if (window.supabase?.createClient && cfg.url && cfg.anonKey) {
        client = window.supabase.createClient(cfg.url, cfg.anonKey, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
        });
        const { data } = await client.auth.getSession();
        currentUserId = data?.session?.user?.id || null;
        return client;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return null;
  }

  function tenantId() {
    return $('tenantSelector')?.value || window.RRN_SESSION?.tenantId || null;
  }

  function paintDeleteButtons() {
    if (painting) return;
    painting = true;
    try {
      document.querySelectorAll('#membersBody tr').forEach(row => {
        const identity = row.querySelector('[data-status-id], [data-role-id]');
        const userId = identity?.dataset.statusId || identity?.dataset.roleId;
        const actions = row.querySelector('.actions');
        if (!userId || !actions) return;

        const existing = actions.querySelector('[data-delete-user-id]');
        if (userId === currentUserId) {
          existing?.remove();
          return;
        }
        if (existing) return;

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'action-btn danger';
        button.dataset.deleteUserId = userId;
        button.textContent = 'Excluir';
        button.title = 'Excluir definitivamente o acesso deste usuário';
        actions.appendChild(button);
      });
    } finally {
      painting = false;
    }
  }

  async function deleteUser(button) {
    const userId = button.dataset.deleteUserId;
    const row = button.closest('tr');
    const name = row?.querySelector('.user-cell strong')?.textContent?.trim() || 'este usuário';
    const email = row?.querySelector('.user-cell small')?.textContent?.split(' · ')[0]?.trim() || '';
    const selectedTenant = tenantId();

    if (!userId || !selectedTenant) return toast('Não foi possível identificar o usuário ou a empresa.');
    if (userId === currentUserId) return toast('Você não pode excluir a própria conta.');

    const first = window.confirm(
      `Excluir definitivamente ${name}${email ? ` (${email})` : ''}?\n\n` +
      'O login e as permissões serão removidos. O histórico de chamados e auditoria será preservado.'
    );
    if (!first) return;

    const typed = window.prompt('Para confirmar a exclusão definitiva, digite EXCLUIR:');
    if (typed !== 'EXCLUIR') {
      if (typed !== null) toast('Exclusão cancelada: confirmação inválida.');
      return;
    }

    button.disabled = true;
    const original = button.textContent;
    button.textContent = 'Excluindo...';

    try {
      const c = await ensureClient();
      if (!c) throw new Error('Supabase indisponível.');

      const { data, error } = await c.functions.invoke('portal-user-access', {
        body: {
          action: 'delete_user',
          user_id: userId,
          tenant_id: selectedTenant
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.ok) throw new Error('Não foi possível confirmar a exclusão.');

      row?.remove();
      toast(`Usuário ${name} excluído. O histórico foi preservado.`);
      setTimeout(() => location.reload(), 900);
    } catch (error) {
      console.error('RRN admin user delete:', error);
      button.disabled = false;
      button.textContent = original;
      toast(error?.message || 'Não foi possível excluir o usuário.');
    }
  }

  function bind() {
    document.addEventListener('click', event => {
      const button = event.target.closest('[data-delete-user-id]');
      if (!button) return;
      event.preventDefault();
      deleteUser(button);
    });

    $('tenantSelector')?.addEventListener('change', () => setTimeout(paintDeleteButtons, 120));

    const root = $('membersBody') || document.body;
    observer = new MutationObserver(() => requestAnimationFrame(paintDeleteButtons));
    observer.observe(root, { childList: true, subtree: true });
  }

  async function boot() {
    await ensureClient();
    bind();
    paintDeleteButtons();
    setTimeout(paintDeleteButtons, 250);
    setTimeout(paintDeleteButtons, 900);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
