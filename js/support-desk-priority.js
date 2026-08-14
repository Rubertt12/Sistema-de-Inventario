(() => {
  'use strict';
  if (window.__RRN_DESK_PRIORITY__) return;
  window.__RRN_DESK_PRIORITY__ = true;

  const cfg = window.RRN_SUPABASE || {};
  const client = window.supabase?.createClient?.(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true }
  });
  if (!client) return;

  const labels = { low: 'Baixa', medium: 'Média', high: 'Alta', critical: 'Crítica' };
  let syncing = false;

  function activeTicketId() {
    return document.querySelector('[data-ticket-id].active')?.dataset.ticketId || null;
  }

  function ensureSelector() {
    const badge = document.getElementById('deskTicketPriority');
    const badges = badge?.parentElement;
    if (!badge || !badges) return;

    let wrap = document.getElementById('deskPriorityEditor');
    if (!wrap) {
      wrap = document.createElement('label');
      wrap.id = 'deskPriorityEditor';
      wrap.className = 'desk-priority-editor';
      wrap.innerHTML = '<span>Classificar prioridade</span><select id="deskPrioritySelect"><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option><option value="critical">Crítica</option></select>';
      badges.appendChild(wrap);
      const style = document.createElement('style');
      style.textContent = '.desk-priority-editor{display:flex;align-items:center;gap:8px;font-size:.78rem;font-weight:700;color:var(--rrn-muted,#667085)}.desk-priority-editor select{border:1px solid var(--rrn-border,#d9e1e5);border-radius:9px;background:var(--rrn-surface,#fff);color:var(--rrn-primary,#163a4d);padding:7px 9px;font:inherit;cursor:pointer}.desk-priority-editor select:disabled{opacity:.55;cursor:not-allowed}@media(max-width:720px){.desk-priority-editor span{display:none}}';
      document.head.appendChild(style);
      wrap.querySelector('select').addEventListener('change', changePriority);
    }
    syncSelector();
  }

  function currentPriorityFromBadge() {
    const badge = document.getElementById('deskTicketPriority');
    if (!badge) return 'medium';
    const cls = ['low','medium','high','critical'].find(v => badge.classList.contains(v));
    return cls || Object.entries(labels).find(([,label]) => label === badge.textContent.trim())?.[0] || 'medium';
  }

  function syncSelector() {
    const select = document.getElementById('deskPrioritySelect');
    if (!select || syncing) return;
    select.value = currentPriorityFromBadge();
    select.disabled = !activeTicketId() || /resolved|closed/.test(document.getElementById('deskTicketStatus')?.className || '');
  }

  async function changePriority(event) {
    const select = event.currentTarget;
    const ticketId = activeTicketId();
    if (!ticketId) return;
    const previous = currentPriorityFromBadge();
    const priority = select.value;
    syncing = true;
    select.disabled = true;
    const { data, error } = await client.rpc('support_set_ticket_priority', {
      p_ticket_id: ticketId,
      p_priority: priority
    });
    syncing = false;
    if (error) {
      select.value = previous;
      select.disabled = false;
      alert(error.message || 'Não foi possível alterar a prioridade.');
      return;
    }
    const ticket = Array.isArray(data) ? data[0] : data;
    const badge = document.getElementById('deskTicketPriority');
    if (badge) {
      badge.textContent = labels[ticket?.priority || priority] || priority;
      badge.className = `desk-priority ${ticket?.priority || priority}`;
    }
    select.disabled = false;
    document.getElementById('deskRefreshBtn')?.click();
  }

  function boot() {
    ensureSelector();
    const root = document.getElementById('deskTicketView') || document.body;
    new MutationObserver(() => { ensureSelector(); syncSelector(); }).observe(root, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['hidden','class']
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();