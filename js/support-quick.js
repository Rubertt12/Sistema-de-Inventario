(() => {
  'use strict';
  const cfg = window.RRN_SUPABASE || {};
  if (!cfg.url || !cfg.anonKey || !window.supabase?.createClient) return;

  const client = window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: 'rrn-guest-support-auth'
    }
  });

  const $ = id => document.getElementById(id);
  const state = { user: null, customer: null, ticket: null, messageChannel: null, ticketChannel: null };
  const statusLabels = { new:'Novo', assigned:'Atribuído', in_progress:'Em atendimento', waiting_requester:'Aguardando você', resolved:'Resolvido', closed:'Encerrado', reopened:'Reaberto' };

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const formatDate = value => value ? new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(value)) : '';
  const normalizeSlug = value => String(value || '').trim().toLowerCase().replace(/\s+/g,'-');

  function showOnly(id) {
    ['quickStart','quickIdentify','quickOpenTicket','quickChat'].forEach(view => { $(view).hidden = view !== id; });
  }

  function alertBox(id, message = '', success = false) {
    const el = $(id);
    if (!message) { el.hidden = true; el.textContent = ''; return; }
    el.hidden = false;
    el.textContent = message;
    el.className = `quick-alert${success ? ' success' : ''}`;
  }

  async function startGuest(event) {
    event?.preventDefault();
    showOnly('quickIdentify');
    setTimeout(() => $('quickName').focus(), 0);
  }

  async function identify(event) {
    event.preventDefault();
    alertBox('quickIdentifyAlert');
    const name = $('quickName').value.trim();
    const org = normalizeSlug($('quickOrg').value);
    const email = $('quickEmail').value.trim();
    const phone = $('quickPhone').value.trim();
    const employee = $('quickEmployee').value.trim();
    if (!email && !phone) return alertBox('quickIdentifyAlert','Informe pelo menos um e-mail ou telefone.');

    const submit = $('quickIdentifyForm').querySelector('button[type="submit"]');
    submit.disabled = true;
    submit.textContent = 'Identificando...';
    try {
      let { data: sessionData } = await client.auth.getSession();
      let user = sessionData?.session?.user;
      if (!user?.is_anonymous) {
        await client.auth.signOut();
        user = null;
      }
      if (!user) {
        const { data, error } = await client.auth.signInAnonymously({
          options: { data: { name, rrn_support_portal: true, rrn_support_tenant_slug: org } }
        });
        if (error) throw error;
        user = data.user;
      }
      state.user = user;

      const { data: customer, error: bootstrapError } = await client.rpc('support_guest_bootstrap', {
        p_portal_slug: org,
        p_name: name,
        p_email: email || null,
        p_phone: phone || null,
        p_employee_number: employee || null
      });
      if (bootstrapError) throw bootstrapError;
      state.customer = Array.isArray(customer) ? customer[0] : customer;
      $('quickUserName').textContent = state.customer?.name || name;
      $('quickCompany').textContent = org;
      showOnly('quickOpenTicket');
      await restoreLatestTicket();
    } catch (error) {
      alertBox('quickIdentifyAlert', error.message || 'Não foi possível iniciar o atendimento sem login.');
    } finally {
      submit.disabled = false;
      submit.textContent = 'Continuar';
    }
  }

  async function restoreLatestTicket() {
    if (!state.customer?.id) return;
    const { data } = await client.from('support_tickets').select('*')
      .eq('requester_id', state.customer.id)
      .not('status','eq','closed')
      .order('opened_at',{ascending:false}).limit(1);
    if (data?.[0]) {
      state.ticket = data[0];
      await openChat();
    }
  }

  async function createTicket(event) {
    event.preventDefault();
    alertBox('quickTicketAlert');
    if (!state.customer?.id) return alertBox('quickTicketAlert','Identificação expirada. Volte e informe seus dados novamente.');
    const machine = $('quickMachine').value.trim();
    const problem = $('quickProblem').value.trim();
    if (!problem) return;
    const title = problem.length > 72 ? `${problem.slice(0,69)}...` : problem;
    const submit = $('quickTicketForm').querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      const { data, error } = await client.from('support_tickets').insert({
        requester_id: state.customer.id,
        machine_query: machine || null,
        title,
        description: problem,
        priority: 'medium'
      }).select('*').single();
      if (error) throw error;
      state.ticket = data;
      await openChat();
    } catch (error) {
      alertBox('quickTicketAlert', error.message || 'Não foi possível abrir o chamado.');
    } finally { submit.disabled = false; }
  }

  async function openChat() {
    if (!state.ticket) return;
    showOnly('quickChat');
    renderTicket();
    await loadMessages();
    subscribe();
  }

  function renderTicket() {
    const t = state.ticket;
    $('quickTicketNumber').textContent = `Chamado #${t.ticket_number}`;
    $('quickTicketTitle').textContent = t.title || 'Atendimento';
    $('quickTicketStatus').textContent = statusLabels[t.status] || t.status;
    $('quickTicketMeta').textContent = [t.machine_query ? `Equipamento: ${t.machine_query}` : null, `Aberto em ${formatDate(t.opened_at)}`, 'Prioridade definida pelo suporte'].filter(Boolean).join(' · ');
    const closed = t.status === 'closed';
    $('quickMessageInput').disabled = closed;
    $('quickMessageForm').querySelector('button').disabled = closed;
    $('quickMessageInput').placeholder = closed ? 'Chamado encerrado.' : 'Digite sua mensagem...';
  }

  async function loadMessages() {
    const { data, error } = await client.from('support_ticket_messages')
      .select('id,ticket_id,sender_id,sender_type,message,created_at')
      .eq('ticket_id',state.ticket.id).order('created_at',{ascending:true});
    if (error) return;
    const box = $('quickMessages');
    if (!data?.length) {
      box.innerHTML = '<div class="quick-info">Chamado aberto. A equipe de suporte verá sua solicitação e poderá responder por aqui.</div>';
      return;
    }
    box.innerHTML = data.map(m => {
      const own = m.sender_id === state.user?.id;
      return `<article class="quick-message ${own ? 'own' : ''}"><strong>${m.sender_type === 'support' ? 'Suporte' : 'Você'}</strong><p>${escapeHtml(m.message)}</p><small>${escapeHtml(formatDate(m.created_at))}</small></article>`;
    }).join('');
    box.scrollTop = box.scrollHeight;
  }

  async function sendMessage(event) {
    event.preventDefault();
    if (!state.ticket) return;
    const input = $('quickMessageInput');
    const message = input.value.trim();
    if (!message) return;
    input.value = '';
    const { error } = await client.from('support_ticket_messages').insert({ ticket_id: state.ticket.id, message });
    if (error) input.value = message;
  }

  function subscribe() {
    if (state.messageChannel) client.removeChannel(state.messageChannel);
    if (state.ticketChannel) client.removeChannel(state.ticketChannel);
    state.messageChannel = client.channel(`guest-msg-${state.ticket.id}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'support_ticket_messages',filter:`ticket_id=eq.${state.ticket.id}`},loadMessages).subscribe();
    state.ticketChannel = client.channel(`guest-ticket-${state.ticket.id}`)
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'support_tickets',filter:`id=eq.${state.ticket.id}`},payload => {
        state.ticket = payload.new;
        renderTicket();
      }).subscribe();
  }

  async function changeIdentity() {
    if (state.messageChannel) client.removeChannel(state.messageChannel);
    if (state.ticketChannel) client.removeChannel(state.ticketChannel);
    await client.auth.signOut();
    state.user = state.customer = state.ticket = null;
    $('quickIdentifyForm').reset();
    const org = new URLSearchParams(location.search).get('org');
    if (org) $('quickOrg').value = org;
    showOnly('quickIdentify');
  }

  async function restoreSession() {
    const { data: { session } } = await client.auth.getSession();
    if (!session?.user?.is_anonymous) return;
    state.user = session.user;
    const { data: customer } = await client.from('support_customers').select('*').eq('user_id',session.user.id).eq('status','active').maybeSingle();
    if (!customer) return;
    state.customer = customer;
    $('quickUserName').textContent = customer.name || 'Usuário';
    $('quickCompany').textContent = 'Suporte rápido';
    showOnly('quickOpenTicket');
    await restoreLatestTicket();
  }

  function bind() {
    $('quickGuestBtn').addEventListener('click',startGuest);
    document.querySelectorAll('[data-quick-back]').forEach(btn => btn.addEventListener('click',() => showOnly('quickStart')));
    $('quickIdentifyForm').addEventListener('submit',identify);
    $('quickTicketForm').addEventListener('submit',createTicket);
    $('quickMessageForm').addEventListener('submit',sendMessage);
    $('quickChangeIdentity').addEventListener('click',changeIdentity);
    const org = new URLSearchParams(location.search).get('org');
    if (org) $('quickOrg').value = org;
  }

  async function boot() { bind(); await restoreSession(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();