(() => {
  'use strict';
  if (window.__RRN_SETTINGS_AGENT_COMPAT_V3__) return;
  window.__RRN_SETTINGS_AGENT_COMPAT_V3__ = true;
  window.__RRN_SETTINGS_AGENT__ = true;

  function client() {
    const cfg = window.RRN_SUPABASE || {};
    if (window.RRN_SUPABASE_CLIENT) return window.RRN_SUPABASE_CLIENT;
    if (!window.supabase?.createClient || !cfg.url || !cfg.anonKey) return null;
    window.RRN_SUPABASE_CLIENT = window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    return window.RRN_SUPABASE_CLIENT;
  }

  function injectStyle() {
    if (document.getElementById('rrnAgentCompatV3Style')) return;
    const style = document.createElement('style');
    style.id = 'rrnAgentCompatV3Style';
    style.textContent = `
      [data-settings-panel="agent"] .settings-agent-grid{grid-template-columns:minmax(0,1fr)!important;gap:16px!important}
      [data-settings-panel="agent"] .settings-agent-device{overflow:hidden}
      [data-settings-panel="agent"] .settings-agent-device-head{grid-template-columns:minmax(0,1fr) minmax(180px,.65fr)!important;gap:14px!important;align-items:start!important}
      [data-settings-panel="agent"] .settings-agent-device-head>div{min-width:0}
      [data-settings-panel="agent"] .settings-agent-device-head>div:last-child{grid-column:1/-1!important;padding-top:8px;border-top:1px solid var(--rrn-border)}
      [data-settings-panel="agent"] .settings-agent-device strong,[data-settings-panel="agent"] .settings-agent-device small{overflow-wrap:anywhere;word-break:break-word}
      [data-settings-panel="agent"] .settings-agent-link{grid-template-columns:minmax(240px,1fr) auto auto auto!important;align-items:end!important}
      [data-settings-panel="agent"] .settings-agent-link .settings-danger-btn{min-height:39px;white-space:nowrap}
      @media(max-width:900px){
        [data-settings-panel="agent"] .settings-agent-device-head,[data-settings-panel="agent"] .settings-agent-link{grid-template-columns:1fr!important}
        [data-settings-panel="agent"] .settings-agent-device-head>div:last-child{grid-column:auto!important}
        [data-settings-panel="agent"] .settings-agent-link button{width:100%}
      }
    `;
    document.head.appendChild(style);
  }

  function removeLegacyDuplicate() {
    document.querySelectorAll('[data-settings-agent-nav]').forEach(node => node.remove());
    document.querySelectorAll('[data-settings-agent-panel]').forEach(node => node.remove());
  }

  function renumberNav() {
    const nav = document.querySelector('.settings-nav');
    if (!nav) return;
    Array.from(nav.children).filter(node => node.matches?.('button')).forEach((button, index) => {
      const badge = button.querySelector(':scope > span');
      if (badge) badge.textContent = String(index + 1).padStart(2, '0');
    });
  }

  async function removeDevice(deviceId, button) {
    if (!deviceId) return;
    const ok = confirm('Remover este agente do RRN Manager? O computador precisará ser vinculado novamente para voltar a aparecer.');
    if (!ok) return;
    const db = client();
    if (!db) return alert('Backend do RRN indisponível.');

    button.disabled = true;
    const original = button.textContent;
    button.textContent = 'Removendo...';
    try {
      const { data, error } = await db.rpc('delete_agent_device_inventory', { p_device_id: deviceId });
      if (error) throw error;
      if (data !== true && data !== null) console.debug('RRN Agent remove:', data);
      button.closest('[data-agent-device]')?.remove();
      document.querySelector('[data-agent-refresh]')?.click();
    } catch (error) {
      console.error('RRN Agent remove:', error);
      alert(error?.message || 'Não foi possível remover o agente.');
      button.disabled = false;
      button.textContent = original;
    }
  }

  function enhanceCards() {
    document.querySelectorAll('[data-settings-panel="agent"] [data-agent-device]').forEach(card => {
      if (card.dataset.rrnRemoveReady === '1') return;
      card.dataset.rrnRemoveReady = '1';
      const actions = card.querySelector('.settings-agent-link');
      if (!actions) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'settings-danger-btn';
      button.textContent = 'Remover agente';
      button.dataset.agentRemove = '1';
      button.addEventListener('click', () => removeDevice(card.dataset.agentDevice, button));
      actions.appendChild(button);
    });
  }

  let applying = false;
  function apply() {
    if (applying) return;
    applying = true;
    try {
      injectStyle();
      removeLegacyDuplicate();
      renumberNav();
      enhanceCards();
    } finally {
      applying = false;
    }
  }

  apply();
  document.addEventListener('DOMContentLoaded', apply, { once: true });
  window.addEventListener('load', apply, { once: true });
  const observer = new MutationObserver(() => queueMicrotask(apply));
  observer.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 20000);
})();
