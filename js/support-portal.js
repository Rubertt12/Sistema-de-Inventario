(() => {
  'use strict';

  const config = window.RRN_SUPABASE;
  if (!config?.url || !config?.anonKey || !window.supabase?.createClient) {
    console.error('RRN Manager: Supabase indisponível no portal de suporte.');
    return;
  }

  const client = window.supabase.createClient(config.url, config.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const state = {
    user: null,
    customer: null,
    portal: null,
    tickets: [],
    selectedTicket: null,
    ticketChannel: null,
    messageChannel: null,
    wizard: null
  };

  const $ = id => document.getElementById(id);
  const authView = $('supportAuthView');
  const appView = $('supportApp');
  const authAlert = $('supportAuthAlert');
  const toastEl = $('supportToast');

  const statusLabels = {
    new: 'Novo',
    assigned: 'Atribuído',
    in_progress: 'Em atendimento',
    waiting_requester: 'Aguardando você',
    resolved: 'Resolvido',
    closed: 'Encerrado',
    reopened: 'Reaberto'
  };

  const priorityLabels = { low: 'Baixa', medium: 'Média', high: 'Alta', critical: 'Crítica' };

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  function normalizeSlug(value) {
    return String(value ?? '').trim().toLowerCase().replace(/\s+/g, '-');
  }

  function formatDate(value) {
    if (!value) return '—';
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
  }

  function formatRemaining(ms) {
    const overdue = ms < 0;
    const total = Math.max(0, Math.floor(Math.abs(ms) / 1000));
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    const parts = days ? `${days}d ${hours}h` : hours ? `${hours}h ${minutes}m` : `${minutes}m ${seconds}s`;
    return overdue ? `${parts} em atraso` : `${parts} restantes`;
  }

  function slaInfo(ticket) {
    if (!ticket) return { label: 'SLA', value: '—' };
    if (ticket.status === 'closed') return { label: 'Chamado', value: 'Encerrado' };
    if (ticket.status === 'resolved') return { label: 'Chamado', value: 'Aguardando sua confirmação' };
    if (!ticket.first_response_at) {
      return { label: 'Primeira resposta', value: ticket.first_response_due_at ? formatRemaining(new Date(ticket.first_response_due_at) - Date.now()) : '—' };
    }
    return { label: 'Resolução', value: ticket.resolution_due_at ? formatRemaining(new Date(ticket.resolution_due_at) - Date.now()) : 'Em atendimento' };
  }

  function showToast(message, type = '') {
    toastEl.textContent = message;
    toastEl.className = `support-toast ${type}`.trim();
    toastEl.hidden = false;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => { toastEl.hidden = true; }, 3600);
  }

  function setAuthAlert(message = '', type = '') {
    if (!message) {
      authAlert.hidden = true;
      authAlert.textContent = '';
      authAlert.className = 'support-alert';
      return;
    }
    authAlert.hidden = false;
    authAlert.textContent = message;
    authAlert.className = `support-alert ${type}`.trim();
  }

  function setAuthTab(tab) {
    const login = tab !== 'register';
    document.querySelectorAll('[data-auth-tab]').forEach(button => {
      button.classList.toggle('active', button.dataset.authTab === (login ? 'login' : 'register'));
    });
    $('supportLoginForm').hidden = !login;
    $('supportRegisterForm').hidden = login;
    setAuthAlert();
  }

  async function resolvePortal(slug) {
    const normalized = normalizeSlug(slug);
    if (!normalized) return null;
    const { data, error } = await client
      .from('support_portals')
      .select('tenant_id,slug,public_name,enabled,allow_signup')
      .eq('slug', normalized)
      .eq('enabled', true)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function handleLogin(event) {
    event.preventDefault();
    setAuthAlert('Validando acesso...');
    const email = $('supportLoginEmail').value.trim();
    const password = $('supportLoginPassword').value;
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthAlert(error.message || 'Não foi possível entrar.', 'error');
      return;
    }
    await loadAuthenticatedPortal();
  }

  async function handleRegister(event) {
    event.preventDefault();
    const name = $('supportRegisterName').value.trim();
    const email = $('supportRegisterEmail').value.trim();
    const password = $('supportRegisterPassword').value;
    const org = normalizeSlug($('supportRegisterOrg').value);
    const employeeNumber = $('supportRegisterEmployee').value.trim();
    const phone = $('supportRegisterPhone').value.trim();

    setAuthAlert('Validando empresa...');
    let portal;
    try {
      portal = await resolvePortal(org);
    } catch (error) {
      setAuthAlert(error.message || 'Falha ao validar a empresa.', 'error');
      return;
    }
    if (!portal || !portal.allow_signup) {
      setAuthAlert('Código da empresa inválido ou cadastro externo desativado.', 'error');
      return;
    }

    setAuthAlert(`Criando acesso para ${portal.public_name}...`);
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          phone,
          employee_number: employeeNumber,
          rrn_support_portal: true,
          rrn_support_tenant_slug: portal.slug
        }
      }
    });

    if (error) {
      setAuthAlert(error.message || 'Não foi possível criar o acesso.', 'error');
      return;
    }

    if (!data.session) {
      setAuthAlert('Conta criada. Confirme o e-mail recebido e depois entre no portal.', 'success');
      setAuthTab('login');
      $('supportLoginEmail').value = email;
      return;
    }

    await loadAuthenticatedPortal();
  }

  function ensureLogoutButton() {
    let button = document.querySelector('[data-support-logout]');
    if (button) return;
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'support-btn ghost';
    button.dataset.supportLogout = '1';
    button.textContent = 'Sair';
    button.addEventListener('click', async () => {
      await client.auth.signOut();
      resetApp();
      showAuth();
    });
    document.querySelector('.support-top-actions')?.appendChild(button);
  }

  function removeLogoutButton() {
    document.querySelector('[data-support-logout]')?.remove();
  }

  function showAuth() {
    authView.hidden = false;
    appView.hidden = true;
    removeLogoutButton();
  }

  function showApp() {
    authView.hidden = true;
    appView.hidden = false;
    ensureLogoutButton();
  }

  async function loadAuthenticatedPortal() {
    const { data: sessionData } = await client.auth.getSession();
    const session = sessionData?.session;
    if (!session?.user) {
      resetApp();
      showAuth();
      return;
    }

    state.user = session.user;
    const { data: customer, error } = await client
      .from('support_customers')
      .select('id,user_id,tenant_id,name,email,phone,employee_number,status')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (error) {
      setAuthAlert(error.message || 'Falha ao carregar seu perfil de suporte.', 'error');
      showAuth();
      return;
    }

    if (!customer) {
      setAuthAlert('Esta conta não está vinculada ao Portal de Suporte. Se você faz parte da equipe técnica, use “Acesso da equipe”.', 'error');
      showAuth();
      ensureLogoutButton();
      return;
    }

    if (customer.status !== 'active') {
      setAuthAlert('Seu acesso ao Portal de Suporte está bloqueado. Procure a equipe responsável.', 'error');
      showAuth();
      ensureLogoutButton();
      return;
    }

    state.customer = customer;
    const { data: portal } = await client
      .from('support_portals')
      .select('tenant_id,slug,public_name,enabled')
      .eq('tenant_id', customer.tenant_id)
      .maybeSingle();
    state.portal = portal || null;

    $('supportCompanyName').textContent = portal?.public_name || 'Portal de suporte';
    $('supportCustomerName').textContent = customer.name || session.user.email || 'Usuário';
    $('supportCustomerMeta').textContent = [customer.employee_number ? `Matrícula ${customer.employee_number}` : null, customer.email || session.user.email].filter(Boolean).join(' · ');

    showApp();
    setAuthAlert();
    await loadTickets();
    subscribeTicketList();
  }

  function resetApp() {
    state.user = null;
    state.customer = null;
    state.portal = null;
    state.tickets = [];
    state.selectedTicket = null;
    if (state.ticketChannel) client.removeChannel(state.ticketChannel);
    if (state.messageChannel) client.removeChannel(state.messageChannel);
    state.ticketChannel = null;
    state.messageChannel = null;
    $('supportTicketList').innerHTML = '';
    $('supportTicketView').hidden = true;
    $('supportEmptyState').hidden = false;
  }

  async function loadTickets(keepSelection = true) {
    if (!state.customer) return;
    const { data, error } = await client
      .from('support_tickets')
      .select('*')
      .eq('requester_id', state.customer.id)
      .order('opened_at', { ascending: false });
    if (error) {
      showToast(error.message || 'Falha ao carregar chamados.', 'error');
      return;
    }
    state.tickets = data || [];
    renderTicketList();

    if (keepSelection && state.selectedTicket) {
      const refreshed = state.tickets.find(ticket => ticket.id === state.selectedTicket.id);
      if (refreshed) {
        state.selectedTicket = refreshed;
        renderSelectedTicket();
      }
    }
  }

  function renderTicketList() {
    const list = $('supportTicketList');
    if (!state.tickets.length) {
      list.innerHTML = '<div class="support-alert">Você ainda não possui chamados. Clique em “Abrir chamado”.</div>';
      return;
    }

    list.innerHTML = state.tickets.map(ticket => {
      const sla = slaInfo(ticket);
      const asset = ticket.asset_display || ticket.asset_tag_snapshot || ticket.machine_query || 'Equipamento não vinculado';
      return `
        <button type="button" class="support-ticket-item ${state.selectedTicket?.id === ticket.id ? 'active' : ''}" data-ticket-id="${ticket.id}">
          <div class="support-ticket-item-top"><strong>#${ticket.ticket_number}</strong><span class="support-status ${ticket.status}">${statusLabels[ticket.status] || ticket.status}</span></div>
          <h3>${escapeHtml(ticket.title)}</h3>
          <p>${escapeHtml(asset)}</p>
          <div class="support-ticket-meta"><span class="support-priority ${ticket.priority}">${priorityLabels[ticket.priority] || ticket.priority}</span><small>${escapeHtml(sla.value)}</small></div>
        </button>`;
    }).join('');
  }

  async function selectTicket(ticketId) {
    const ticket = state.tickets.find(item => item.id === ticketId);
    if (!ticket) return;
    state.selectedTicket = ticket;
    renderTicketList();
    renderSelectedTicket();
    await loadMessages(ticket.id);
    subscribeMessages(ticket.id);
  }

  function renderSelectedTicket() {
    const ticket = state.selectedTicket;
    if (!ticket) return;
    $('supportEmptyState').hidden = true;
    $('supportTicketView').hidden = false;
    $('supportTicketNumber').textContent = `Chamado #${ticket.ticket_number} · aberto em ${formatDate(ticket.opened_at)}`;
    $('supportTicketTitle').textContent = ticket.title;
    $('supportTicketStatus').textContent = statusLabels[ticket.status] || ticket.status;
    $('supportTicketStatus').className = `support-status ${ticket.status}`;
    $('supportTicketPriority').textContent = priorityLabels[ticket.priority] || ticket.priority;
    $('supportTicketPriority').className = `support-priority ${ticket.priority}`;

    const assetName = ticket.asset_display || (ticket.machine_query ? `Identificação informada: ${ticket.machine_query}` : 'Equipamento não vinculado');
    const assetMeta = [
      ticket.asset_tag_snapshot ? `PAT: ${ticket.asset_tag_snapshot}` : null,
      ticket.asset_serial_snapshot ? `SN: ${ticket.asset_serial_snapshot}` : null,
      ticket.asset_hostname_snapshot ? `Host: ${ticket.asset_hostname_snapshot}` : null,
      ticket.sector_name_snapshot ? `Setor: ${ticket.sector_name_snapshot}` : null
    ].filter(Boolean).join(' · ');
    $('supportAssetName').textContent = assetName;
    $('supportAssetMeta').textContent = assetMeta || 'O suporte pode vincular o equipamento durante o atendimento.';

    const sla = slaInfo(ticket);
    $('supportSlaLabel').textContent = sla.label;
    $('supportSlaValue').textContent = sla.value;

    const resolutionBox = $('supportResolutionBox');
    const resolved = ticket.status === 'resolved';
    resolutionBox.hidden = !resolved;
    $('supportResolutionText').textContent = ticket.resolution ? `Solução: ${ticket.resolution}` : 'O suporte marcou este chamado como resolvido.';
    $('supportCauseText').textContent = ticket.cause ? `Causa: ${ticket.cause}` : '';

    const messageInput = $('supportMessageInput');
    const sendButton = $('supportMessageForm').querySelector('button');
    const closed = ticket.status === 'closed';
    messageInput.disabled = closed;
    sendButton.disabled = closed;
    messageInput.placeholder = closed ? 'Chamado encerrado.' : 'Digite uma mensagem para o suporte...';
  }

  async function loadMessages(ticketId) {
    const { data, error } = await client
      .from('support_ticket_messages')
      .select('id,ticket_id,sender_id,sender_type,message,created_at')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    if (error) {
      showToast(error.message || 'Falha ao carregar a conversa.', 'error');
      return;
    }
    const box = $('supportMessages');
    if (!data?.length) {
      box.innerHTML = '<div class="support-alert">A conversa começa aqui. O suporte verá suas mensagens neste chamado.</div>';
      return;
    }
    box.innerHTML = data.map(message => {
      const own = message.sender_id === state.user?.id;
      const author = message.sender_type === 'support' ? 'Suporte' : 'Você';
      return `<article class="support-message ${own ? 'own' : ''}"><strong>${author}</strong><p>${escapeHtml(message.message)}</p><small>${formatDate(message.created_at)}</small></article>`;
    }).join('');
    box.scrollTop = box.scrollHeight;
  }

  async function sendMessage(event) {
    event.preventDefault();
    const ticket = state.selectedTicket;
    const input = $('supportMessageInput');
    const message = input.value.trim();
    if (!ticket || !message || ticket.status === 'closed') return;
    input.value = '';
    const { error } = await client.from('support_ticket_messages').insert({ ticket_id: ticket.id, message });
    if (error) {
      input.value = message;
      showToast(error.message || 'Não foi possível enviar a mensagem.', 'error');
      return;
    }
    await loadMessages(ticket.id);
    await loadTickets();
  }

  function subscribeTicketList() {
    if (!state.customer) return;
    if (state.ticketChannel) client.removeChannel(state.ticketChannel);
    state.ticketChannel = client
      .channel(`support-requester-${state.customer.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'support_tickets', filter: `requester_id=eq.${state.customer.id}`
      }, async payload => {
        await loadTickets();
        if (state.selectedTicket?.id === payload.new?.id || state.selectedTicket?.id === payload.old?.id) {
          const refreshed = state.tickets.find(ticket => ticket.id === state.selectedTicket.id);
          if (refreshed) { state.selectedTicket = refreshed; renderSelectedTicket(); }
        }
      })
      .subscribe();
  }

  function subscribeMessages(ticketId) {
    if (state.messageChannel) client.removeChannel(state.messageChannel);
    state.messageChannel = client
      .channel(`support-messages-${ticketId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'support_ticket_messages', filter: `ticket_id=eq.${ticketId}`
      }, async () => {
        if (state.selectedTicket?.id === ticketId) await loadMessages(ticketId);
      })
      .subscribe();
  }

  function wizardBubble(content, type = 'bot', html = false) {
    const feed = $('supportWizardFeed');
    const bubble = document.createElement('div');
    bubble.className = `support-wizard-bubble ${type === 'user' ? 'user' : ''}`;
    if (html) bubble.innerHTML = content;
    else bubble.textContent = content;
    feed.appendChild(bubble);
    feed.scrollTop = feed.scrollHeight;
    return bubble;
  }

  function setWizardInput(enabled, placeholder = 'Digite sua resposta...') {
    const form = $('supportWizardForm');
    const input = $('supportWizardInput');
    form.classList.toggle('disabled', !enabled);
    input.disabled = !enabled;
    input.placeholder = placeholder;
    if (enabled) setTimeout(() => input.focus(), 0);
  }

  function openWizard() {
    state.wizard = { step: 'machine', machineQuery: '', assetId: null, assetLabel: '', problem: '', priority: 'medium' };
    $('supportWizardFeed').innerHTML = '';
    $('supportWizardInput').value = '';
    $('supportNewTicketModal').hidden = false;
    wizardBubble('<strong>Assistente</strong>Olá! Qual equipamento está com problema?<br><br>Informe o <b>patrimônio</b>, <b>número de série</b> ou <b>hostname</b>.', 'bot', true);
    setWizardInput(true, 'Ex: AM005483, 2X0D6R3 ou NOTE-123');
  }

  function closeWizard() {
    $('supportNewTicketModal').hidden = true;
    state.wizard = null;
  }

  async function handleWizardSubmit(event) {
    event.preventDefault();
    const wizard = state.wizard;
    const input = $('supportWizardInput');
    const answer = input.value.trim();
    if (!wizard || !answer) return;
    input.value = '';

    if (wizard.step === 'machine') {
      wizard.machineQuery = answer;
      wizardBubble(answer, 'user');
      setWizardInput(false, 'Procurando equipamento...');
      const { data, error } = await client.rpc('support_lookup_asset', { p_query: answer });
      if (error) {
        wizardBubble('Não consegui consultar o inventário agora. Você ainda pode abrir o chamado normalmente. Conte o que está acontecendo.');
        wizard.step = 'problem';
        setWizardInput(true, 'Descreva o problema...');
        return;
      }

      if (!data?.length) {
        wizardBubble('<strong>Assistente</strong>Não encontrei um ativo com essa identificação. Sem problema: o suporte poderá vinculá-lo depois.<br><br>Conte o que está acontecendo.', 'bot', true);
        wizard.step = 'problem';
        setWizardInput(true, 'Descreva o problema...');
        return;
      }

      const choices = data.map((asset, index) => {
        const title = [asset.manufacturer, asset.model, asset.equipment_type].filter(Boolean).join(' ') || 'Equipamento';
        const meta = [asset.asset_tag ? `PAT: ${asset.asset_tag}` : null, asset.serial_number ? `SN: ${asset.serial_number}` : null, asset.hostname ? `Host: ${asset.hostname}` : null, asset.sector_name ? `Setor: ${asset.sector_name}` : null].filter(Boolean).join(' · ');
        return `<div class="support-asset-choice"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(meta)}</span><div class="support-choice-row"><button type="button" class="primary" data-wizard-asset="${index}">É este equipamento</button></div></div>`;
      }).join('');
      wizard.matches = data;
      wizard.step = 'asset-choice';
      wizardBubble(`<strong>Equipamento encontrado</strong>${choices}<div class="support-choice-row"><button type="button" data-wizard-no-asset="1">Nenhum deles</button></div>`, 'bot', true);
      setWizardInput(false, 'Escolha uma opção acima');
      return;
    }

    if (wizard.step === 'problem') {
      wizard.problem = answer;
      wizardBubble(answer, 'user');
      wizard.step = 'priority';
      wizardBubble('<strong>Assistente</strong>Qual é o impacto do problema?<div class="support-choice-row"><button type="button" data-wizard-priority="low">Baixo</button><button type="button" data-wizard-priority="medium">Médio</button><button type="button" data-wizard-priority="high">Alto</button><button type="button" data-wizard-priority="critical">Crítico</button></div>', 'bot', true);
      setWizardInput(false, 'Escolha o impacto acima');
    }
  }

  function chooseAsset(index) {
    const wizard = state.wizard;
    const asset = wizard?.matches?.[index];
    if (!wizard || !asset) return;
    wizard.assetId = asset.asset_id;
    wizard.assetLabel = [asset.manufacturer, asset.model, asset.asset_tag || asset.serial_number].filter(Boolean).join(' ');
    wizardBubble(wizard.assetLabel || 'Equipamento selecionado', 'user');
    wizard.step = 'problem';
    wizardBubble('<strong>Assistente</strong>Perfeito. Agora conte o que está acontecendo com o equipamento.', 'bot', true);
    setWizardInput(true, 'Descreva o problema...');
  }

  function chooseNoAsset() {
    if (!state.wizard) return;
    state.wizard.assetId = null;
    wizardBubble('Nenhum deles', 'user');
    state.wizard.step = 'problem';
    wizardBubble('<strong>Assistente</strong>Tudo bem. O suporte fará o vínculo depois. Conte o que está acontecendo.', 'bot', true);
    setWizardInput(true, 'Descreva o problema...');
  }

  function choosePriority(priority) {
    const wizard = state.wizard;
    if (!wizard || !priorityLabels[priority]) return;
    wizard.priority = priority;
    wizard.step = 'confirm';
    wizardBubble(priorityLabels[priority], 'user');
    wizardBubble(`<strong>Assistente</strong>Confira antes de abrir:<br><br><b>Equipamento:</b> ${escapeHtml(wizard.assetLabel || wizard.machineQuery || 'não vinculado')}<br><b>Impacto:</b> ${priorityLabels[priority]}<br><b>Problema:</b> ${escapeHtml(wizard.problem)}<div class="support-choice-row"><button type="button" class="primary" data-wizard-create="1">Criar chamado</button><button type="button" data-wizard-restart="1">Recomeçar</button></div>`, 'bot', true);
    setWizardInput(false, 'Confirme acima');
  }

  async function createTicketFromWizard() {
    const wizard = state.wizard;
    if (!wizard || !state.customer || !wizard.problem) return;
    setWizardInput(false, 'Criando chamado...');
    const cleanTitle = wizard.problem.replace(/\s+/g, ' ').trim();
    const title = cleanTitle.length > 78 ? `${cleanTitle.slice(0, 75)}...` : cleanTitle;
    const { data: ticket, error } = await client
      .from('support_tickets')
      .insert({
        requester_id: state.customer.id,
        asset_id: wizard.assetId,
        machine_query: wizard.machineQuery || null,
        title,
        description: wizard.problem,
        priority: wizard.priority
      })
      .select('*')
      .single();

    if (error) {
      wizardBubble(`<strong>Não foi possível criar o chamado.</strong><br>${escapeHtml(error.message || 'Tente novamente.')}`, 'bot', true);
      setWizardInput(true, 'Tente novamente ou feche a janela');
      return;
    }

    const { error: messageError } = await client.from('support_ticket_messages').insert({ ticket_id: ticket.id, message: wizard.problem });
    if (messageError) console.warn('Chamado criado, mas a primeira mensagem não foi gravada:', messageError);

    wizardBubble(`<strong>Chamado #${ticket.ticket_number} criado com sucesso.</strong><br>O SLA começou a contar no momento da abertura.`, 'bot', true);
    showToast(`Chamado #${ticket.ticket_number} criado com sucesso.`, 'success');
    await loadTickets(false);
    closeWizard();
    await selectTicket(ticket.id);
  }

  async function resolutionAction(action) {
    const ticket = state.selectedTicket;
    if (!ticket || ticket.status !== 'resolved') return;
    const { error } = await client.rpc('support_customer_resolution_action', { p_ticket_id: ticket.id, p_action: action });
    if (error) {
      showToast(error.message || 'Não foi possível atualizar o chamado.', 'error');
      return;
    }
    if (action === 'reopen') {
      await client.from('support_ticket_messages').insert({ ticket_id: ticket.id, message: 'O problema ainda não foi resolvido. Solicito a reabertura do chamado.' });
      showToast('Chamado reaberto e devolvido ao suporte.', 'success');
    } else {
      showToast('Chamado encerrado. Obrigado pela confirmação.', 'success');
    }
    await loadTickets();
    const refreshed = state.tickets.find(item => item.id === ticket.id);
    if (refreshed) { state.selectedTicket = refreshed; renderSelectedTicket(); await loadMessages(ticket.id); }
  }

  function bindEvents() {
    document.querySelectorAll('[data-auth-tab]').forEach(button => button.addEventListener('click', () => setAuthTab(button.dataset.authTab)));
    $('supportLoginForm').addEventListener('submit', handleLogin);
    $('supportRegisterForm').addEventListener('submit', handleRegister);
    $('supportNewTicketBtn').addEventListener('click', openWizard);
    $('supportRefreshBtn').addEventListener('click', () => loadTickets());
    $('supportWizardClose').addEventListener('click', closeWizard);
    $('supportWizardForm').addEventListener('submit', handleWizardSubmit);
    $('supportMessageForm').addEventListener('submit', sendMessage);
    $('supportConfirmResolutionBtn').addEventListener('click', () => resolutionAction('confirm'));
    $('supportReopenBtn').addEventListener('click', () => resolutionAction('reopen'));

    $('supportTicketList').addEventListener('click', event => {
      const item = event.target.closest('[data-ticket-id]');
      if (item) selectTicket(item.dataset.ticketId);
    });

    $('supportWizardFeed').addEventListener('click', event => {
      const asset = event.target.closest('[data-wizard-asset]');
      if (asset) return chooseAsset(Number(asset.dataset.wizardAsset));
      if (event.target.closest('[data-wizard-no-asset]')) return chooseNoAsset();
      const priority = event.target.closest('[data-wizard-priority]');
      if (priority) return choosePriority(priority.dataset.wizardPriority);
      if (event.target.closest('[data-wizard-create]')) return createTicketFromWizard();
      if (event.target.closest('[data-wizard-restart]')) return openWizard();
    });

    $('supportNewTicketModal').addEventListener('click', event => {
      if (event.target === $('supportNewTicketModal')) closeWizard();
    });

    window.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !$('supportNewTicketModal').hidden) closeWizard();
    });
  }

  async function boot() {
    bindEvents();
    const params = new URLSearchParams(location.search);
    const org = normalizeSlug(params.get('org'));
    if (org) {
      $('supportRegisterOrg').value = org;
      try {
        const portal = await resolvePortal(org);
        if (portal) $('supportOrgHint').textContent = `Portal: ${portal.public_name}`;
      } catch {}
    }
    if (params.get('mode') === 'register') setAuthTab('register');
    await loadAuthenticatedPortal();

    client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') { resetApp(); showAuth(); }
      if (event === 'SIGNED_IN' && session?.user && !state.customer) setTimeout(loadAuthenticatedPortal, 0);
    });

    setInterval(() => {
      if (state.selectedTicket) renderSelectedTicket();
      if (state.tickets.length) renderTicketList();
    }, 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
