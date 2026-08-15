(() => {
  'use strict';
  if (window.__RRN_SETTINGS_AGENT_QUEUE_V4__) return;
  window.__RRN_SETTINGS_AGENT_QUEUE_V4__ = true;
  window.__RRN_SETTINGS_AGENT__ = true;

  if (!/\/configuracoes\.html$/i.test(location.pathname)) return;

  const SETUP_URL = 'https://github.com/Rubertt12/Sistema-de-Inventario/releases/download/rrn-agent-latest/RRN.Agent.Setup.exe';
  let assignedIds = new Set();
  let loadingAssigned = false;

  function db() {
    const cfg = window.RRN_SUPABASE || {};
    if (window.RRN_SUPABASE_CLIENT) return window.RRN_SUPABASE_CLIENT;
    if (!window.supabase?.createClient || !cfg.url || !cfg.anonKey) return null;
    window.RRN_SUPABASE_CLIENT = window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    return window.RRN_SUPABASE_CLIENT;
  }

  function isAssignedToSector(device) {
    const sector = String(device?.metadata?.inventory_link?.sector || '').trim();
    return Boolean(sector && !/estoque/i.test(sector));
  }

  async function refreshAssignedIds() {
    if (loadingAssigned) return;
    const client = db();
    if (!client) return;
    loadingAssigned = true;
    try {
      const { data, error } = await client.from('agent_devices').select('id,metadata').limit(500);
      if (error) throw error;
      assignedIds = new Set((Array.isArray(data) ? data : []).filter(isAssignedToSector).map(item => String(item.id)));
      applyQueueVisibility();
      [350, 900, 1800].forEach(delay => setTimeout(applyQueueVisibility, delay));
    } catch (error) {
      console.warn('RRN Agent fila de vinculação:', error?.message || error);
    } finally {
      loadingAssigned = false;
    }
  }

  function applyQueueVisibility() {
    const panel = document.querySelector('[data-settings-panel="agent"]');
    if (!panel) return;
    const list = panel.querySelector('.settings-agent-list');
    if (!list) return;

    const cards = [...list.querySelectorAll('[data-agent-device]')];
    cards.forEach(card => {
      const assigned = assignedIds.has(String(card.dataset.agentDevice || ''));
      card.hidden = assigned;
      card.style.display = assigned ? 'none' : '';
    });

    const visible = cards.filter(card => !card.hidden);
    let empty = list.querySelector('[data-agent-queue-empty]');
    if (!visible.length && cards.length) {
      if (!empty) {
        empty = document.createElement('div');
        empty.className = 'settings-agent-empty';
        empty.dataset.agentQueueEmpty = '1';
        empty.textContent = 'Nenhuma máquina aguardando vinculação. Máquinas já atribuídas a setores ficam somente no Inventário.';
        list.appendChild(empty);
      }
      empty.hidden = false;
    } else if (empty) {
      empty.hidden = true;
    }

    const cardHost = list.closest('.settings-card');
    const heading = cardHost?.querySelector('.settings-card-head h2');
    const sub = cardHost?.querySelector('.settings-card-head p');
    if (heading) heading.textContent = 'Máquinas aguardando vinculação';
    if (sub) sub.textContent = 'Depois de vinculada a um setor, a máquina sai desta fila e permanece somente no Inventário.';

    const summary = cardHost?.querySelectorAll('.settings-agent-summary > div');
    if (summary?.length) {
      const firstLabel = summary[0].querySelector('span');
      const firstValue = summary[0].querySelector('strong');
      const firstSmall = summary[0].querySelector('small');
      if (firstLabel) firstLabel.textContent = 'Aguardando vínculo';
      if (firstValue) firstValue.textContent = String(visible.length);
      if (firstSmall) firstSmall.textContent = 'máquinas pendentes';
    }
  }

  function triggerDownload(url) {
    const link = document.createElement('a');
    link.href = url;
    link.download = 'RRN.Agent.Setup.exe';
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function downloadInstaller(button) {
    const client = db();
    if (!client) return alert('Backend do RRN indisponível.');
    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'Preparando instalador...';
    try {
      const { data, error } = await client.rpc('create_agent_enrollment_token', { p_expires_hours: 2, p_max_uses: 1 });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      const code = String(row?.enrollment_code || '').trim();
      if (!code) throw new Error('O backend não retornou o código automático.');

      try { await navigator.clipboard.writeText(code); }
      catch {
        const area = document.createElement('textarea');
        area.value = code;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        area.remove();
      }

      sessionStorage.setItem('rrn_agent_last_enrollment_code', code);
      triggerDownload(SETUP_URL);
      button.textContent = 'Instalador baixado';
      setTimeout(() => { button.textContent = original; button.disabled = false; }, 2200);
    } catch (error) {
      console.error('RRN Agent instalador:', error);
      alert(error?.message || 'Não foi possível preparar o instalador.');
      button.textContent = original;
      button.disabled = false;
    }
  }

  function enhanceInstaller() {
    const panel = document.querySelector('[data-settings-panel="agent"]');
    if (!panel) return;
    const installCard = panel.querySelector('.settings-agent-grid > .settings-card:first-child');
    const actions = installCard?.querySelector('.settings-agent-actions');
    if (!installCard || !actions) return;

    const description = installCard.querySelector('.settings-card-head p');
    if (description) description.textContent = 'Baixe o instalador. O RRN gera automaticamente um vínculo de uso único para esta instalação.';

    installCard.querySelector('.settings-agent-code')?.setAttribute('hidden', '');
    installCard.querySelector('.settings-agent-command')?.setAttribute('hidden', '');
    actions.querySelector('[data-agent-generate]')?.setAttribute('hidden', '');
    actions.querySelector('[data-agent-copy]')?.setAttribute('hidden', '');
    actions.querySelectorAll('a').forEach(link => link.hidden = true);

    let button = actions.querySelector('[data-agent-auto-installer]');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'settings-primary-btn';
      button.dataset.agentAutoInstaller = '1';
      button.textContent = 'Baixar instalador';
      button.addEventListener('click', () => downloadInstaller(button));
      actions.prepend(button);
    }

    let note = installCard.querySelector('[data-agent-auto-note]');
    if (!note) {
      note = document.createElement('div');
      note.className = 'settings-info-box';
      note.dataset.agentAutoNote = '1';
      note.style.marginTop = '14px';
      note.innerHTML = '<strong>Instalação automática</strong><p>O código é criado no clique e copiado automaticamente. Ao abrir o RRN Agent Setup, ele preenche o vínculo e você só confirma a instalação.</p>';
      installCard.appendChild(note);
    }
  }

  function enhance() {
    enhanceInstaller();
    applyQueueVisibility();
  }

  function scheduleEnhance() {
    [80, 300, 800, 1600].forEach(delay => setTimeout(enhance, delay));
  }

  document.addEventListener('click', event => {
    const target = event.target instanceof Element
      ? event.target.closest('[data-settings-nav="agent"],[data-agent-refresh],[data-agent-link]')
      : null;
    if (!target) return;
    scheduleEnhance();
    if (target.matches('[data-settings-nav="agent"],[data-agent-refresh]')) setTimeout(refreshAssignedIds, 450);
    if (target.matches('[data-agent-link]')) {
      setTimeout(refreshAssignedIds, 900);
      setTimeout(refreshAssignedIds, 2200);
    }
  }, true);

  function boot() {
    scheduleEnhance();
    setTimeout(refreshAssignedIds, 800);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
