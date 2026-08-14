(() => {
  'use strict';
  if (window.__RRN_SUPPORT_DESK_LINK__) return;
  window.__RRN_SUPPORT_DESK_LINK__ = true;

  let client = null;
  let allowed = false;
  let checked = false;
  let profile = null;
  let channel = null;
  let refreshTimer = null;

  function ensureStylesheet(href, marker) {
    if (document.querySelector(`link[${marker}]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute(marker, '1');
    document.head.appendChild(link);
  }

  function ensureScript(src, marker) {
    if (document.querySelector(`script[${marker}]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.setAttribute(marker, '1');
    document.head.appendChild(script);
  }

  function ensureDashboardExtensions() {
    ensureStylesheet('/style/mobile-navbar-v2.css', 'data-rrn-mobile-navbar-v2');
    ensureScript('/js/mobile-navbar-v2.js', 'data-rrn-mobile-navbar-v2');
    ensureScript('/js/service-desk-inventory-bridge.js', 'data-rrn-service-inventory-bridge');
  }

  function ensureAlertStyles() {
    if (document.getElementById('rrn-support-alert-style')) return;
    const style = document.createElement('style');
    style.id = 'rrn-support-alert-style';
    style.textContent = `
      .rrn-support-alerts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:0 0 18px}
      .rrn-support-alert{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 16px;border:1px solid var(--rrn-border,#d8e1e4);border-radius:14px;background:var(--rrn-surface,#fff);box-shadow:0 8px 22px rgba(22,58,77,.05)}
      .rrn-support-alert[hidden]{display:none!important}
      .rrn-support-alert-main{display:flex;align-items:center;gap:12px;min-width:0}
      .rrn-support-alert-icon{display:grid;place-items:center;flex:0 0 42px;width:42px;height:42px;border-radius:12px;background:rgba(47,125,120,.11);font-size:1.2rem}
      .rrn-support-alert-copy{display:flex;flex-direction:column;min-width:0}
      .rrn-support-alert-copy strong{color:var(--rrn-heading,#163a4d);font-size:.9rem}
      .rrn-support-alert-copy small{color:var(--rrn-muted,#66757f);font-size:.76rem}
      .rrn-support-alert-count{font:800 1.35rem/1 Manrope,Inter,sans-serif;color:var(--rrn-primary,#163a4d)}
      .rrn-support-alert.sla{border-color:rgba(217,119,69,.28);background:rgba(217,119,69,.07)}
      .rrn-support-alert.sla .rrn-support-alert-icon{background:rgba(217,119,69,.13)}
      .rrn-support-alert.overdue{border-color:rgba(191,68,68,.3);background:rgba(191,68,68,.07)}
      .rrn-support-alert-actions{display:flex;align-items:center;gap:8px}
      .rrn-support-alert a{display:inline-flex;align-items:center;min-height:36px;padding:0 12px;border-radius:9px;background:var(--rrn-primary,#163a4d);color:#fff;font-size:.76rem;font-weight:800;text-decoration:none;white-space:nowrap}
      @media(max-width:760px){.rrn-support-alerts{grid-template-columns:1fr}.rrn-support-alert{align-items:flex-start}.rrn-support-alert-actions{flex-direction:column;align-items:flex-end}}
    `;
    document.head.appendChild(style);
  }

  async function waitForClient() {
    for (let attempt = 0; attempt < 80; attempt += 1) {
      client = window.RRN_SUPABASE_CLIENT || window.RRN_GET_SUPABASE_CLIENT?.() || null;
      if (client) {
        ensureDashboardExtensions();
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return false;
  }

  async function resolveAccess() {
    ensureStylesheet('/style/mobile-navbar-v2.css', 'data-rrn-mobile-navbar-v2');
    ensureScript('/js/mobile-navbar-v2.js', 'data-rrn-mobile-navbar-v2');
    if (!await waitForClient()) { checked = true; return sync(); }
    try {
      const { data:{session} } = await client.auth.getSession();
      if (!session?.user) return;
      const { data:p } = await client.from('profiles').select('user_id,tenant_id,status,role').eq('user_id', session.user.id).maybeSingle();
      profile = p || null;
      if (!profile || profile.status !== 'active') return;
      const { data:staff } = await client.from('support_staff').select('id').eq('user_id', session.user.id).eq('tenant_id', profile.tenant_id).eq('status','active').maybeSingle();
      allowed = !!staff || profile.role === 'monitoramento';
    } catch (error) {
      console.warn('RRN support desk access:', error);
    } finally {
      checked = true;
      sync();
      if (allowed) {
        await refreshAlerts();
        subscribeAlerts();
      }
    }
  }

  function removeLinks() {
    document.querySelectorAll('[data-support-desk-link]').forEach(el => el.remove());
    document.getElementById('rrnSupportAlerts')?.remove();
  }

  function mount() {
    if (!allowed) return removeLinks();
    const actions = document.querySelector('.dashboard-actions');
    if (actions && !actions.querySelector('[data-support-desk-link]')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.supportDeskLink = '1';
      button.textContent = '🎫 Central de Chamados';
      button.addEventListener('click', () => location.href = '/chamados.html');
      actions.appendChild(button);
    }
    const dropdown = document.getElementById('userDropdown');
    if (dropdown && !dropdown.querySelector('[data-support-desk-link]')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.supportDeskLink = '1';
      button.textContent = '🎫 Central de Chamados';
      button.addEventListener('click', event => { event.stopPropagation(); location.href = '/chamados.html'; });
      const config = dropdown.querySelector('button[onclick*="openConfigModal"]');
      dropdown.insertBefore(button, config || dropdown.firstChild);
    }
    mountAlertHost();
  }

  function mountAlertHost() {
    ensureAlertStyles();
    if (document.getElementById('rrnSupportAlerts')) return;
    const host = document.createElement('section');
    host.id = 'rrnSupportAlerts';
    host.className = 'rrn-support-alerts';
    host.innerHTML = `
      <article class="rrn-support-alert" id="rrnNewTicketAlert" hidden>
        <div class="rrn-support-alert-main"><span class="rrn-support-alert-icon">💬</span><div class="rrn-support-alert-copy"><strong>Novo chamado recebido</strong><small id="rrnNewTicketText">Há solicitações aguardando atendimento.</small></div></div>
        <div class="rrn-support-alert-actions"><span class="rrn-support-alert-count" id="rrnNewTicketCount">0</span><a href="/chamados.html?filter=new">Ver novos</a></div>
      </article>
      <article class="rrn-support-alert sla" id="rrnSlaAlert" hidden>
        <div class="rrn-support-alert-main"><span class="rrn-support-alert-icon">⏱️</span><div class="rrn-support-alert-copy"><strong>SLA exige atenção</strong><small id="rrnSlaText">Há chamados próximos do vencimento.</small></div></div>
        <div class="rrn-support-alert-actions"><span class="rrn-support-alert-count" id="rrnSlaCount">0</span><a href="/chamados.html?filter=sla">Ver SLA</a></div>
      </article>`;
    const main = document.querySelector('main');
    if (main) main.insertBefore(host, main.firstChild);
    else document.body.insertBefore(host, document.body.firstChild);
  }

  function activeDue(ticket) {
    if (!ticket || ['resolved','closed'].includes(ticket.status) || ticket.sla_paused_at) return null;
    const due = !ticket.first_response_at ? ticket.first_response_due_at : ticket.resolution_due_at;
    if (!due) return null;
    const ms = new Date(due).getTime() - Date.now();
    return Number.isFinite(ms) ? ms : null;
  }

  async function refreshAlerts() {
    if (!allowed || !profile || !client) return;
    try {
      const { data, error } = await client.from('support_tickets')
        .select('id,ticket_number,status,first_response_at,first_response_due_at,resolution_due_at,sla_paused_at,opened_at')
        .eq('tenant_id', profile.tenant_id)
        .order('opened_at', { ascending:false });
      if (error) throw error;
      const tickets = data || [];
      const fresh = tickets.filter(t => ['new','reopened'].includes(t.status));
      const dueItems = tickets.map(t => ({ ticket:t, ms:activeDue(t) })).filter(x => x.ms != null && x.ms <= 60 * 60 * 1000);
      const overdue = dueItems.filter(x => x.ms < 0);
      const near = dueItems.filter(x => x.ms >= 0);

      mountAlertHost();
      const newAlert = document.getElementById('rrnNewTicketAlert');
      const slaAlert = document.getElementById('rrnSlaAlert');
      if (newAlert) newAlert.hidden = fresh.length === 0;
      if (document.getElementById('rrnNewTicketCount')) document.getElementById('rrnNewTicketCount').textContent = String(fresh.length);
      if (document.getElementById('rrnNewTicketText')) document.getElementById('rrnNewTicketText').textContent = fresh.length === 1 ? '1 solicitação aguarda primeiro atendimento.' : `${fresh.length} solicitações aguardam primeiro atendimento.`;

      if (slaAlert) {
        slaAlert.hidden = dueItems.length === 0;
        slaAlert.classList.toggle('overdue', overdue.length > 0);
      }
      if (document.getElementById('rrnSlaCount')) document.getElementById('rrnSlaCount').textContent = String(dueItems.length);
      if (document.getElementById('rrnSlaText')) {
        document.getElementById('rrnSlaText').textContent = overdue.length
          ? `${overdue.length} SLA${overdue.length === 1 ? '' : 's'} vencido${overdue.length === 1 ? '' : 's'}${near.length ? ` e ${near.length} próximo${near.length === 1 ? '' : 's'} do vencimento` : ''}.`
          : `${near.length} chamado${near.length === 1 ? '' : 's'} com SLA vencendo em até 1 hora.`;
      }

      const deskButton = document.querySelector('[data-support-desk-link]');
      if (deskButton) {
        const totalAttention = fresh.length + dueItems.length;
        deskButton.dataset.alertCount = String(totalAttention);
        deskButton.textContent = totalAttention ? `🎫 Central de Chamados (${totalAttention})` : '🎫 Central de Chamados';
      }
    } catch (error) {
      console.warn('RRN dashboard support alerts:', error);
    }
  }

  function subscribeAlerts() {
    if (channel || !client || !profile) return;
    channel = client.channel(`rrn-dashboard-support-${profile.tenant_id}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'support_tickets', filter:`tenant_id=eq.${profile.tenant_id}` }, () => {
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(refreshAlerts, 120);
      })
      .subscribe();
    setInterval(refreshAlerts, 30000);
  }

  function sync() {
    if (!checked || !allowed) return removeLinks();
    mount();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', resolveAccess, { once:true });
  else resolveAccess();
  new MutationObserver(sync).observe(document.documentElement, { childList:true, subtree:true });
  window.addEventListener('beforeunload', () => { if (channel && client) client.removeChannel(channel); }, { once:true });
})();
