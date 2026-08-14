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
      .select('id,status,ticket_number,opened_at,closed_at')
      .eq('requester_id', customer.id)
      .neq('status', 'closed')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ticketError) throw ticketError;
    return ticket;
  }

  function protocolFromHeader() {
    const text = document.getElementById('quickTicketNumber')?.textContent || '';
    const match = text.match(/#?\s*(\d+)/);
    return match?.[1] || '';
  }

  function normalizeProtocolHeader() {
    const label = document.getElementById('quickTicketNumber');
    if (!label) return;
    const number = protocolFromHeader();
    if (!number) return;
    const next = `Protocolo #${number}`;
    if (label.textContent !== next) label.textContent = next;
  }

  function showFinished(ticket = {}) {
    const views = ['quickStart','quickIdentify','quickOpenTicket','quickBot','quickChat','quickFinished'];
    views.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.hidden = id !== 'quickFinished';
    });

    const number = ticket.ticket_number || protocolFromHeader();
    const protocol = document.getElementById('quickProtocolNumber');
    if (protocol) protocol.textContent = number ? `#${number}` : '—';

    const endedAt = ticket.closed_at ? new Date(ticket.closed_at) : new Date();
    const meta = document.getElementById('quickFinishedMeta');
    if (meta) {
      meta.textContent = `Atendimento encerrado em ${new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(endedAt)}. Guarde este protocolo para consultas futuras.`;
    }
  }

  function watchProtocolAndClosure() {
    const number = document.getElementById('quickTicketNumber');
    const status = document.getElementById('quickTicketStatus');

    normalizeProtocolHeader();

    if (number) {
      new MutationObserver(() => normalizeProtocolHeader())
        .observe(number, { childList:true, characterData:true, subtree:true });
    }

    if (status) {
      new MutationObserver(() => {
        normalizeProtocolHeader();
        if (/encerrado/i.test(status.textContent || '')) {
          showFinished({ ticket_number: protocolFromHeader(), closed_at: new Date().toISOString() });
        }
      }).observe(status, { childList:true, characterData:true, subtree:true });
    }
  }

  async function endChat(button) {
    if (!confirm('Deseja encerrar este atendimento? Depois disso não será possível enviar novas mensagens neste chamado.')) return;
    button.disabled = true;
    const original = button.textContent;
    button.textContent = 'Encerrando...';
    try {
      const ticket = await latestOpenTicket();
      if (!ticket?.id) throw new Error('Não há atendimento aberto para encerrar.');
      const { data, error } = await client.rpc('support_guest_close_ticket', { p_ticket_id: ticket.id });
      if (error) throw error;
      showFinished(Array.isArray(data) ? data[0] || ticket : data || ticket);
    } catch (error) {
      console.error('RRN suporte rápido - encerrar atendimento:', error);
      alert(error?.message || 'Não foi possível encerrar o atendimento.');
      button.disabled = false;
      button.textContent = original;
    }
  }

  async function newAttendance() {
    try { await client.auth.signOut(); } catch {}
    ['quickIdentifyForm','quickTicketForm','quickMessageForm'].forEach(id => document.getElementById(id)?.reset?.());
    const views = ['quickStart','quickIdentify','quickOpenTicket','quickBot','quickChat','quickFinished'];
    views.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.hidden = id !== 'quickStart';
    });
  }

  function mount() {
    const head = document.querySelector('#quickChat .quick-chat-head');
    if (head && !document.getElementById('quickEndChat')) {
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

    document.getElementById('quickNewAttendance')?.addEventListener('click', newAttendance);
    watchProtocolAndClosure();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();