(() => {
  'use strict';
  if (window.__RRN_ADMIN_REGISTRATION_APPROVAL__) return;
  window.__RRN_ADMIN_REGISTRATION_APPROVAL__ = true;

  const cfg = window.RRN_SUPABASE || {};
  const client = window.RRN_SUPABASE_CLIENT || window.supabase?.createClient?.(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  if (!client) return;
  window.RRN_SUPABASE_CLIENT = client;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtDate = value => value ? new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(value)) : '—';

  function toast(text) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { el.hidden = true; }, 3200);
  }

  function ensureUi() {
    if (document.getElementById('registrationsNav')) return;
    const nav = document.querySelector('.admin-nav');
    const content = document.querySelector('.admin-content');
    if (!nav || !content) return;

    const button = document.createElement('button');
    button.id = 'registrationsNav';
    button.type = 'button';
    button.textContent = 'Novos cadastros';
    nav.insertBefore(button, nav.querySelector('[data-view="companies"]') || nav.children[1] || null);

    const section = document.createElement('section');
    section.className = 'view';
    section.id = 'registrationsPanel';
    section.innerHTML = `
      <div class="page-heading">
        <div><span class="eyebrow">Plataforma</span><h1>Novos cadastros</h1><p>Defina o tipo de ambiente dos usuários que se cadastraram sem convite.</p></div>
        <span class="counter" id="pendingRegistrationCount">0 pendentes</span>
      </div>
      <div class="panel">
        <div class="panel-heading inline-heading"><div><span class="eyebrow">Aguardando análise</span><h2>Solicitações pendentes</h2><p>O acesso só é liberado depois da confirmação do e-mail e da sua classificação.</p></div><button type="button" class="btn-ghost" id="refreshPendingRegistrations">Atualizar</button></div>
        <div class="table-wrap"><table class="rrn-pending-table"><thead><tr><th>Usuário</th><th>E-mail</th><th>Cadastro</th><th>Tipo de ambiente</th><th>Nome do ambiente</th><th class="align-right">Ação</th></tr></thead><tbody id="pendingRegistrationsBody"></tbody></table></div>
      </div>`;
    content.appendChild(section);

    const style = document.createElement('style');
    style.textContent = `
      .rrn-pending-table select,.rrn-pending-table input{width:100%;min-width:150px;padding:9px 10px;border:1px solid var(--rrn-border,rgba(22,58,77,.18));border-radius:9px;background:var(--rrn-surface,#fff);color:inherit}.rrn-pending-email-state{display:inline-flex;margin-top:5px;padding:3px 7px;border-radius:999px;font-size:.68rem;font-weight:800}.rrn-pending-email-state.ok{background:rgba(47,125,120,.12);color:#2f7d78}.rrn-pending-email-state.wait{background:rgba(217,119,69,.12);color:#a85d35}.rrn-pending-empty{padding:28px!important;text-align:center;color:var(--rrn-muted,#66757F)}@media(max-width:900px){.rrn-pending-table{min-width:980px}}`;
    document.head.appendChild(style);

    button.addEventListener('click', () => {
      document.querySelectorAll('.admin-nav button').forEach(b => b.classList.remove('active'));
      button.classList.add('active');
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      section.classList.add('active');
      loadPending();
    });

    document.querySelectorAll('.admin-nav button:not(#registrationsNav)').forEach(existing => {
      existing.addEventListener('click', () => section.classList.remove('active'));
    });
    document.getElementById('refreshPendingRegistrations')?.addEventListener('click', loadPending);
  }

  function defaultWorkspaceName(row, type) {
    if (type === 'technician_store') return `${row.name || 'Técnico'} - Loja Técnica`;
    return '';
  }

  function bindRows(rows) {
    document.querySelectorAll('[data-pending-type]').forEach(select => {
      select.addEventListener('change', () => {
        const row = rows.find(item => item.user_id === select.dataset.pendingType);
        const input = document.querySelector(`[data-pending-name="${CSS.escape(select.dataset.pendingType)}"]`);
        if (!row || !input) return;
        input.placeholder = select.value === 'company' ? 'Nome da empresa/equipe' : 'Nome da loja/assistência';
        if (!input.value.trim() || / - Loja Técnica$/.test(input.value)) input.value = defaultWorkspaceName(row, select.value);
      });
    });

    document.querySelectorAll('[data-approve-registration]').forEach(button => {
      button.addEventListener('click', async () => {
        const id = button.dataset.approveRegistration;
        const row = rows.find(item => item.user_id === id);
        if (!row) return;
        if (!row.email_confirmed) return toast('O usuário ainda não confirmou o e-mail.');
        const type = document.querySelector(`[data-pending-type="${CSS.escape(id)}"]`)?.value || 'company';
        const name = document.querySelector(`[data-pending-name="${CSS.escape(id)}"]`)?.value.trim() || '';
        if (type === 'company' && name.length < 2) return toast('Informe o nome da empresa/equipe.');
        if (!confirm(`Liberar ${row.name || row.email} como ${type === 'company' ? 'Empresa/equipe' : 'Técnico/Vendedor'}?`)) return;
        button.disabled = true;
        button.textContent = 'Liberando...';
        try {
          const { error } = await client.rpc('platform_approve_registration', {
            p_user_id: id,
            p_workspace_type: type,
            p_workspace_name: name
          });
          if (error) throw error;
          toast('Cadastro liberado com sucesso.');
          await loadPending();
          setTimeout(() => location.reload(), 650);
        } catch (error) {
          toast(error?.message || 'Não foi possível liberar o cadastro.');
          button.disabled = false;
          button.textContent = 'Liberar acesso';
        }
      });
    });
  }

  async function loadPending() {
    const body = document.getElementById('pendingRegistrationsBody');
    if (!body) return;
    body.innerHTML = '<tr><td colspan="6" class="rrn-pending-empty">Carregando solicitações...</td></tr>';
    const { data, error } = await client.rpc('platform_pending_registrations');
    if (error) {
      body.innerHTML = `<tr><td colspan="6" class="rrn-pending-empty">${esc(error.message || 'Falha ao carregar cadastros.')}</td></tr>`;
      return;
    }
    const rows = data || [];
    const counter = document.getElementById('pendingRegistrationCount');
    if (counter) counter.textContent = `${rows.length} ${rows.length === 1 ? 'pendente' : 'pendentes'}`;
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="6" class="rrn-pending-empty">Nenhum cadastro aguardando liberação.</td></tr>';
      return;
    }
    body.innerHTML = rows.map(row => `
      <tr>
        <td class="user-cell"><strong>${esc(row.name || 'Sem nome')}</strong><small>${esc(row.email || '')}</small></td>
        <td>${row.email_confirmed ? '<span class="rrn-pending-email-state ok">E-mail confirmado</span>' : '<span class="rrn-pending-email-state wait">Aguardando confirmação</span>'}</td>
        <td>${esc(fmtDate(row.requested_at))}</td>
        <td><select data-pending-type="${row.user_id}"><option value="company">Empresa / equipe</option><option value="technician_store">Técnico / Vendedor</option></select></td>
        <td><input data-pending-name="${row.user_id}" placeholder="Nome da empresa/equipe"></td>
        <td class="align-right"><button class="action-btn" data-approve-registration="${row.user_id}" ${row.email_confirmed ? '' : 'disabled'}>Liberar acesso</button></td>
      </tr>`).join('');
    bindRows(rows);
  }

  (async () => {
    try {
      const { data: { session } } = await client.auth.getSession();
      if (!session?.user) return;
      const { data: isPlatform, error } = await client.rpc('is_platform_admin');
      if (error || !isPlatform) return;
      ensureUi();
      await loadPending();
    } catch (error) {
      console.warn('RRN pending registrations:', error);
    }
  })();
})();