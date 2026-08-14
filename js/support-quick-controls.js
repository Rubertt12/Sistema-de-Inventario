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

  async function latestOpenTicket() {
    const { data: { session } } = await client.auth.getSession();
    if (!session?.user?.id) throw new Error('Sessão de atendimento não encontrada.');

    const { data: customer, error: customerError } = await client
      .from('support_customers')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('status', 'active')
      .maybeSingle();
    if (customerError) throw customerError;
    if (!customer?.id) throw new Error('Atendimento não encontrado.');

    const { data: ticket, error: ticketError } = await client
      .from('support_tickets')
      .select('id,status,ticket_number')
      .eq('requester_id', customer.id)
      .neq('status', 'closed')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ticketError) throw ticketError;
    return ticket;
  }

  async function endChat(button) {
    if (!confirm('Deseja encerrar este atendimento? Depois disso não será possível enviar novas mensagens neste chamado.')) return;
    button.disabled = true;
    const original = button.textContent;
    button.textContent = 'Encerrando...';
    try {
      const ticket = await latestOpenTicket();
      if (!ticket?.id) throw new Error('Não há atendimento aberto para encerrar.');
      const { error } = await client.rpc('support_guest_close_ticket', { p_ticket_id: ticket.id });
      if (error) throw error;

      const status = document.getElementById('quickTicketStatus');
      if (status) status.textContent = 'Encerrado';
      const input = document.getElementById('quickMessageInput');
      const send = document.querySelector('#quickMessageForm button[type="submit"]');
      if (input) {
        input.value = '';
        input.disabled = true;
        input.placeholder = 'Atendimento encerrado.';
      }
      if (send) send.disabled = true;
      button.textContent = 'Atendimento encerrado';
      button.classList.add('ended');
    } catch (error) {
      console.error('RRN suporte rápido - encerrar atendimento:', error);
      alert(error?.message || 'Não foi possível encerrar o atendimento.');
      button.disabled = false;
      button.textContent = original;
    }
  }

  function mount() {
    const head = document.querySelector('#quickChat .quick-chat-head');
    if (!head || document.getElementById('quickEndChat')) return;

    const currentStatus = document.getElementById('quickTicketStatus');
    const actions = document.createElement('div');
    actions.className = 'quick-chat-actions';
    if (currentStatus) actions.appendChild(currentStatus);

    const end = document.createElement('button');
    end.id = 'quickEndChat';
    end.type = 'button';
    end.className = 'quick-end-chat';
    end.textContent = 'Encerrar';
    end.addEventListener('click', () => endChat(end));
    actions.appendChild(end);
    head.appendChild(actions);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();