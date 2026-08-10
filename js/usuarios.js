(() => {
  'use strict';

  const cfg = window.RRN_SUPABASE || {};
  const notice = document.getElementById('pageNotice');
  const configured = /^https:\/\/.+\.supabase\.co$/i.test(cfg.url || '')
    && Boolean(cfg.anonKey)
    && !String(cfg.url).includes('SEU-PROJETO')
    && !String(cfg.anonKey).includes('SUA_CHAVE');

  function showNotice(text) {
    notice.hidden = false;
    notice.textContent = text;
  }

  if (!configured || !window.supabase?.createClient) {
    showNotice('Configure o Supabase em js/supabase-config.js antes de usar a gestão de usuários.');
    return;
  }

  const client = window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  let me = null;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[ch]));

  function toast(text) {
    const el = document.getElementById('toast');
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { el.hidden = true; }, 2600);
  }

  function roleLabel(role) {
    return { admin:'Administrador', operador:'Operador', monitoramento:'Monitoramento' }[role] || role;
  }

  function dateLabel(value) {
    if (!value) return '—';
    return new Intl.DateTimeFormat('pt-BR', { dateStyle:'short', timeStyle:'short' }).format(new Date(value));
  }

  async function getMe(userId) {
    const { data, error } = await client
      .from('profiles')
      .select('user_id,tenant_id,name,email,role,status,tenants(name,slug)')
      .eq('user_id', userId)
      .single();
    if (error) throw error;
    return data;
  }

  async function loadMembers() {
    const { data, error } = await client
      .from('profiles')
      .select('user_id,name,email,role,status,created_at')
      .eq('tenant_id', me.tenant_id)
      .order('created_at', { ascending:true });
    if (error) throw error;

    const body = document.getElementById('membersBody');
    document.getElementById('memberCount').textContent = `${data.length} ${data.length === 1 ? 'usuário' : 'usuários'}`;

    if (!data.length) {
      body.innerHTML = '<tr><td colspan="5">Nenhum usuário encontrado.</td></tr>';
      return;
    }

    body.innerHTML = data.map(user => {
      const isSelf = user.user_id === me.user_id;
      return `<tr>
        <td class="user-cell"><strong>${esc(user.name || 'Sem nome')}</strong><small>${esc(user.email || '')}${isSelf ? ' · você' : ''}</small></td>
        <td><span class="badge badge-${esc(user.role)}">${esc(roleLabel(user.role))}</span></td>
        <td><span class="badge badge-${esc(user.status)}">${user.status === 'active' ? 'Ativo' : 'Inativo'}</span></td>
        <td>${dateLabel(user.created_at)}</td>
        <td class="align-right"><div class="actions">
          <button class="action-btn" data-action="role" data-id="${user.user_id}" data-role="${esc(user.role)}" ${isSelf ? 'disabled' : ''}>Alterar perfil</button>
          <button class="action-btn ${user.status === 'active' ? 'danger' : ''}" data-action="status" data-id="${user.user_id}" data-status="${esc(user.status)}" ${isSelf ? 'disabled' : ''}>${user.status === 'active' ? 'Desativar' : 'Ativar'}</button>
        </div></td>
      </tr>`;
    }).join('');

    body.querySelectorAll('[data-action="role"]').forEach(button => button.addEventListener('click', async () => {
      const current = button.dataset.role;
      const next = prompt('Novo perfil: admin, operador ou monitoramento', current);
      if (!next) return;
      const normalized = next.trim().toLowerCase();
      if (!['admin','operador','monitoramento'].includes(normalized)) return toast('Perfil inválido.');
      const { error } = await client.from('profiles').update({ role: normalized }).eq('user_id', button.dataset.id).eq('tenant_id', me.tenant_id);
      if (error) return toast(error.message);
      toast('Perfil atualizado.');
      await loadMembers();
    }));

    body.querySelectorAll('[data-action="status"]').forEach(button => button.addEventListener('click', async () => {
      const next = button.dataset.status === 'active' ? 'inactive' : 'active';
      const { error } = await client.from('profiles').update({ status: next }).eq('user_id', button.dataset.id).eq('tenant_id', me.tenant_id);
      if (error) return toast(error.message);
      toast(next === 'active' ? 'Usuário ativado.' : 'Usuário desativado.');
      await loadMembers();
    }));
  }

  async function loadInvites() {
    const { data, error } = await client
      .from('tenant_invitations')
      .select('id,email,role,expires_at,used_at,created_at')
      .eq('tenant_id', me.tenant_id)
      .order('created_at', { ascending:false })
      .limit(25);
    if (error) throw error;

    const body = document.getElementById('invitesBody');
    if (!data.length) {
      body.innerHTML = '<tr><td colspan="4">Nenhum convite gerado.</td></tr>';
      return;
    }

    body.innerHTML = data.map(invite => {
      const expired = !invite.used_at && new Date(invite.expires_at).getTime() < Date.now();
      const status = invite.used_at ? 'used' : expired ? 'expired' : 'pending';
      const label = status === 'used' ? 'Utilizado' : status === 'expired' ? 'Expirado' : 'Pendente';
      return `<tr>
        <td>${esc(invite.email || 'Qualquer e-mail')}</td>
        <td><span class="badge badge-${esc(invite.role)}">${esc(roleLabel(invite.role))}</span></td>
        <td>${dateLabel(invite.expires_at)}</td>
        <td><span class="badge badge-${status}">${label}</span></td>
      </tr>`;
    }).join('');
  }

  function makeInviteCode() {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2,'0')).join('');
  }

  async function sha256(value) {
    const data = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,'0')).join('');
  }

  document.getElementById('inviteForm').addEventListener('submit', async event => {
    event.preventDefault();
    const button = document.getElementById('inviteButton');
    const email = document.getElementById('inviteEmail').value.trim().toLowerCase();
    const role = document.getElementById('inviteRole').value;
    const days = Number(document.getElementById('inviteDays').value || 7);
    const code = makeInviteCode();
    const tokenHash = await sha256(code);
    const expiresAt = new Date(Date.now() + days * 86400000).toISOString();

    button.disabled = true;
    button.textContent = 'Gerando...';
    try {
      const { error } = await client.from('tenant_invitations').insert({
        tenant_id: me.tenant_id,
        email,
        token_hash: tokenHash,
        role,
        expires_at: expiresAt,
        created_by: me.user_id
      });
      if (error) throw error;

      document.getElementById('inviteCode').textContent = code;
      document.getElementById('inviteResult').hidden = false;
      event.target.reset();
      toast('Convite criado.');
      await loadInvites();
    } catch (error) {
      toast(error.message || 'Falha ao gerar convite.');
    } finally {
      button.disabled = false;
      button.textContent = 'Gerar convite';
    }
  });

  document.getElementById('copyInviteButton').addEventListener('click', async () => {
    const code = document.getElementById('inviteCode').textContent;
    if (!code) return;
    await navigator.clipboard.writeText(code);
    toast('Código copiado.');
  });

  document.getElementById('refreshButton').addEventListener('click', async () => {
    await Promise.all([loadMembers(), loadInvites()]);
    toast('Dados atualizados.');
  });

  (async () => {
    try {
      const { data: { session } } = await client.auth.getSession();
      if (!session?.user) return location.replace('index.html');
      me = await getMe(session.user.id);
      if (!me || me.status !== 'active' || me.role !== 'admin') return location.replace('dashboard.html');

      document.getElementById('tenantName').textContent = me.tenants?.name || 'Workspace';
      document.getElementById('currentAdmin').textContent = `${me.name || me.email} · administrador`;
      await Promise.all([loadMembers(), loadInvites()]);
    } catch (error) {
      console.error(error);
      showNotice(error.message || 'Não foi possível carregar a administração do workspace.');
    }
  })();
})();
