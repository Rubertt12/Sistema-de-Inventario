(() => {
  'use strict';
  if (window.__RRN_ADMIN_INVITES_V2__) return;
  window.__RRN_ADMIN_INVITES_V2__ = true;

  const cfg = window.RRN_SUPABASE || {};
  if (!window.supabase?.createClient || !cfg.url || !cfg.anonKey) return;
  const client = window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  const $ = id => document.getElementById(id);
  const toast = text => {
    const el = $('toast'); if (!el) return;
    el.textContent = text; el.hidden = false;
    clearTimeout(toast.timer); toast.timer = setTimeout(() => { el.hidden = true; }, 3200);
  };

  function code() {
    const bytes = new Uint8Array(18);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('').toUpperCase();
  }
  async function hash(value) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  }
  function showResult(value, tenantName) {
    const result = $('inviteResult');
    const output = $('inviteCode');
    if (output) output.textContent = value;
    if (result) {
      result.hidden = false;
      result.dataset.tenant = tenantName || '';
      result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  async function submit(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const form = $('inviteForm');
    const button = $('inviteButton');
    const tenantId = $('tenantSelector')?.value || '';
    const tenantName = $('tenantSelector')?.selectedOptions?.[0]?.textContent?.trim() || 'empresa selecionada';
    const email = $('inviteEmail')?.value.trim().toLowerCase() || null;
    const role = $('inviteRole')?.value || 'operador';
    const days = Number($('inviteDays')?.value || 7);
    if (!tenantId) return toast('Selecione uma empresa antes de gerar o convite.');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast('Informe um e-mail válido.');
    if (!['admin','operador','monitoramento'].includes(role)) return toast('Perfil de convite inválido.');

    const rawCode = code();
    button.disabled = true;
    const original = button.textContent;
    button.textContent = 'Gerando...';
    if ($('inviteResult')) $('inviteResult').hidden = true;
    try {
      const { data: auth, error: authError } = await client.auth.getUser();
      if (authError || !auth?.user?.id) throw new Error('Sua sessão administrativa expirou. Entre novamente.');
      const payload = {
        tenant_id: tenantId,
        email,
        token_hash: await hash(rawCode),
        role,
        expires_at: new Date(Date.now() + days * 86400000).toISOString(),
        created_by: auth.user.id
      };
      const { error } = await client.from('tenant_invitations').insert(payload);
      if (error) throw error;
      showResult(rawCode, tenantName);
      if ($('inviteEmail')) $('inviteEmail').value = '';
      toast(`Convite para ${tenantName} criado com sucesso.`);
      setTimeout(() => $('refreshButton')?.click(), 150);
    } catch (error) {
      console.error('RRN convite:', error);
      toast(error.message || 'Não foi possível gerar o convite.');
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }

  async function copy() {
    const value = $('inviteCode')?.textContent?.trim();
    if (!value) return toast('Nenhum código foi gerado ainda.');
    try {
      await navigator.clipboard.writeText(value);
      toast('Código copiado.');
    } catch {
      const range = document.createRange();
      range.selectNodeContents($('inviteCode'));
      const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      toast('Código selecionado. Use Ctrl+C para copiar.');
    }
  }

  function boot() {
    const form = $('inviteForm');
    if (form) form.addEventListener('submit', submit, true);
    const copyButton = $('copyInviteButton');
    if (copyButton) copyButton.onclick = copy;
    const button = $('inviteButton');
    if (button) button.type = 'submit';
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();