(() => {
  'use strict';
  if (window.__RRN_SUPPORT_TYPING_INDICATOR__) return;
  window.__RRN_SUPPORT_TYPING_INDICATOR__ = true;

  const cfg = window.RRN_SUPABASE || {};
  if (!cfg.url || !cfg.anonKey || !window.supabase?.createClient) return;

  const client = window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });

  const isDesk = Boolean(document.getElementById('deskMessageInput'));
  const input = document.getElementById(isDesk ? 'deskMessageInput' : 'supportMessageInput');
  const form = document.getElementById(isDesk ? 'deskMessageForm' : 'supportMessageForm');
  const chat = document.querySelector(isDesk ? '.desk-chat' : '.support-chat');
  if (!input || !form || !chat) return;

  let sessionUser = null;
  let identity = { name: isDesk ? 'Suporte' : 'Usuário', avatar_url: '', actor_type: isDesk ? 'support' : 'requester' };
  let channel = null;
  let channelTicketId = null;
  let localStopTimer = null;
  let remoteStopTimer = null;
  let lastSentAt = 0;

  const style = document.createElement('style');
  style.textContent = `
    .rrn-typing{display:flex;align-items:center;gap:9px;min-height:42px;padding:7px 14px;border-top:1px solid var(--desk-border,var(--support-border,rgba(22,58,77,.12)));background:var(--desk-surface,var(--support-surface,#fff));color:var(--desk-muted,var(--support-muted,#6b7d86));font:600 .69rem/1.2 Inter,system-ui,sans-serif}
    .rrn-typing[hidden]{display:none!important}
    .rrn-typing-avatar{width:28px;height:28px;border-radius:50%;object-fit:cover;flex:0 0 28px;border:1px solid rgba(127,145,155,.22);background:#dfe8eb}
    .rrn-typing-fallback{display:grid;place-items:center;font-weight:850;font-size:.64rem;color:#173c4d;background:#dcebed}
    .rrn-typing-copy{display:flex;align-items:center;gap:6px;min-width:0}
    .rrn-typing-name{max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--desk-text,var(--support-text,#183847));font-weight:800}
    .rrn-typing-dots{display:inline-flex;align-items:center;gap:3px;margin-left:1px}
    .rrn-typing-dots i{display:block;width:4px;height:4px;border-radius:50%;background:currentColor;opacity:.3;animation:rrnTypingBounce 1.1s infinite ease-in-out}
    .rrn-typing-dots i:nth-child(2){animation-delay:.14s}.rrn-typing-dots i:nth-child(3){animation-delay:.28s}
    @keyframes rrnTypingBounce{0%,60%,100%{transform:translateY(0);opacity:.3}30%{transform:translateY(-3px);opacity:1}}
  `;
  document.head.appendChild(style);

  const indicator = document.createElement('div');
  indicator.className = 'rrn-typing';
  indicator.hidden = true;
  indicator.setAttribute('aria-live', 'polite');
  form.insertAdjacentElement('beforebegin', indicator);

  const activeTicketId = () => document.querySelector('[data-ticket-id].active')?.dataset.ticketId || null;

  function initials(name) {
    return String(name || '?').trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase() || '?';
  }

  function renderRemote(payload) {
    if (!payload || !payload.typing || payload.user_id === sessionUser?.id) {
      indicator.hidden = true;
      return;
    }
    const name = payload.name || (payload.actor_type === 'support' ? 'Suporte' : 'Usuário');
    const avatar = payload.avatar_url
      ? `<img class="rrn-typing-avatar" src="${String(payload.avatar_url).replace(/"/g, '&quot;')}" alt="" />`
      : `<span class="rrn-typing-avatar rrn-typing-fallback">${initials(name)}</span>`;
    indicator.innerHTML = `${avatar}<div class="rrn-typing-copy"><span class="rrn-typing-name">${name.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</span><span>está digitando</span><span class="rrn-typing-dots" aria-label="digitando"><i></i><i></i><i></i></span></div>`;
    indicator.hidden = false;
    clearTimeout(remoteStopTimer);
    remoteStopTimer = setTimeout(() => { indicator.hidden = true; }, 2200);
  }

  async function loadIdentity() {
    const { data: { session } } = await client.auth.getSession();
    sessionUser = session?.user || null;
    if (!sessionUser) return;

    try {
      if (isDesk) {
        const [{ data: staff }, { data: profile }] = await Promise.all([
          client.from('support_staff').select('display_name,avatar_url').eq('user_id', sessionUser.id).maybeSingle(),
          client.from('profiles').select('name,email').eq('user_id', sessionUser.id).maybeSingle()
        ]);
        identity = {
          name: staff?.display_name || profile?.name || sessionUser.email || 'Suporte',
          avatar_url: staff?.avatar_url || '',
          actor_type: 'support'
        };
      } else {
        const { data: customer } = await client.from('support_customers')
          .select('name,email,avatar_url')
          .eq('user_id', sessionUser.id)
          .maybeSingle();
        identity = {
          name: customer?.name || customer?.email || sessionUser.email || 'Usuário',
          avatar_url: customer?.avatar_url || '',
          actor_type: 'requester'
        };
      }
    } catch (_) {
      identity.name = sessionUser.email || identity.name;
    }
  }

  async function joinTicket(ticketId) {
    if (!ticketId || ticketId === channelTicketId) return;
    if (channel) {
      try { await client.removeChannel(channel); } catch (_) {}
    }
    channelTicketId = ticketId;
    indicator.hidden = true;
    channel = client.channel(`rrn-support-typing-${ticketId}`, {
      config: { broadcast: { self: false, ack: false } }
    });
    channel.on('broadcast', { event: 'typing' }, ({ payload }) => {
      if (payload?.ticket_id !== channelTicketId) return;
      renderRemote(payload);
    });
    channel.subscribe();
  }

  async function sendTyping(typing) {
    const ticketId = activeTicketId();
    if (!ticketId || !sessionUser) return;
    await joinTicket(ticketId);
    if (!channel) return;
    try {
      await channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          ticket_id: ticketId,
          user_id: sessionUser.id,
          name: identity.name,
          avatar_url: identity.avatar_url,
          actor_type: identity.actor_type,
          typing: Boolean(typing),
          at: Date.now()
        }
      });
    } catch (_) {}
  }

  function onInput() {
    if (input.disabled || !input.value.trim()) {
      sendTyping(false);
      return;
    }
    const now = Date.now();
    if (now - lastSentAt > 650) {
      lastSentAt = now;
      sendTyping(true);
    }
    clearTimeout(localStopTimer);
    localStopTimer = setTimeout(() => sendTyping(false), 1250);
  }

  input.addEventListener('input', onInput);
  input.addEventListener('focus', onInput);
  input.addEventListener('blur', () => sendTyping(false));
  form.addEventListener('submit', () => sendTyping(false), true);

  document.addEventListener('click', event => {
    if (!event.target.closest('[data-ticket-id]')) return;
    setTimeout(() => joinTicket(activeTicketId()), 80);
  });

  const observer = new MutationObserver(() => {
    const id = activeTicketId();
    if (id && id !== channelTicketId) joinTicket(id);
    if (!id) indicator.hidden = true;
  });
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class','hidden'] });

  window.addEventListener('beforeunload', () => {
    sendTyping(false);
    clearTimeout(localStopTimer);
    clearTimeout(remoteStopTimer);
  }, { once: true });

  (async () => {
    await loadIdentity();
    const id = activeTicketId();
    if (id) await joinTicket(id);
  })();
})();