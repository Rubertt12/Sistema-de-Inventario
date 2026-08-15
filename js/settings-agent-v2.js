(() => {
  'use strict';
  if (window.__RRN_SETTINGS_AGENT_V2__) return;
  window.__RRN_SETTINGS_AGENT_V2__ = true;

  const RELEASE_BASE = 'https://github.com/Rubertt12/Sistema-de-Inventario/releases/download/rrn-agent-latest';
  const INSTALL_URL = `${RELEASE_BASE}/install.ps1`;
  const ZIP_URL = `${RELEASE_BASE}/RRN-Agent-Windows-x64.zip`;
  const state = { devices: [], token: null, command: '', candidates: [], mounted: false, refreshing: false };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
  const norm = value => String(value ?? '').trim();

  function role() {
    if (window.RRN_SESSION?.role) return String(window.RRN_SESSION.role).toLowerCase();
    try { return String(JSON.parse(localStorage.getItem('usuarioLogado') || '{}').perfil || '').toLowerCase(); }
    catch { return ''; }
  }

  function canManage() { return ['admin', 'operador'].includes(role()); }

  function client() {
    const cfg = window.RRN_SUPABASE || {};
    if (window.RRN_SUPABASE_CLIENT) return window.RRN_SUPABASE_CLIENT;
    if (!window.supabase?.createClient || !cfg.url || !cfg.anonKey) return null;
    window.RRN_SUPABASE_CLIENT = window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    return window.RRN_SUPABASE_CLIENT;
  }

  function readArray(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  }

  function writeArray(key, value) {
    localStorage.setItem(key, JSON.stringify(Array.isArray(value) ? value : []));
  }

  function identity(asset) {
    return norm(asset?.etiqueta || asset?.patrimonio || asset?.serial || asset?.numeroSerie || asset?.serviceTag || asset?.nome || asset?.hostname || 'Equipamento');
  }

  function inventoryCandidates() {
    const rows = [];
    readArray('setores').forEach((sector, sectorIndex) => {
      (Array.isArray(sector?.maquinas) ? sector.maquinas : []).forEach((asset, assetIndex) => {
        rows.push({
          key: `sector:${sectorIndex}:${asset.id ?? assetIndex}`,
          source: 'sector', sectorIndex, assetIndex,
          sectorName: norm(sector?.nome) || `Setor ${sectorIndex + 1}`,
          asset,
          label: identity(asset)
        });
      });
    });

    readArray('rrn_stock_assets').forEach((asset, stockIndex) => {
      if (String(asset?.origemEstoque || '').toLowerCase() === 'rrn-agent') return;
      rows.push({
        key: `stock:${asset.id ?? stockIndex}`,
        source: 'stock', stockIndex,
        sectorName: 'Máquinas em estoque',
        asset,
        label: identity(asset)
      });
    });
    return rows;
  }

  function commandFor(code) {
    return `$p = Join-Path $env:TEMP 'rrn-install.ps1'; Invoke-WebRequest '${INSTALL_URL}' -OutFile $p; powershell.exe -NoProfile -ExecutionPolicy Bypass -File $p -EnrollmentCode '${code}'`;
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  function ageHours(value) {
    const time = new Date(value || 0).getTime();
    return Number.isFinite(time) ? Math.max(0, (Date.now() - time) / 3600000) : Infinity;
  }

  function deviceStatus(device) {
    const hours = ageHours(device.last_seen_at);
    if (hours <= 14) return ['ok', 'Atualizado'];
    if (hours <= 36) return ['warn', 'Atenção'];
    return ['off', 'Sem comunicação'];
  }

  function injectStyle() {
    if (document.getElementById('rrnSettingsAgentV2Style')) return;
    const style = document.createElement('style');
    style.id = 'rrnSettingsAgentV2Style';
    style.textContent = `
      .settings-nav{counter-reset:rrnSettingsNav}
      .settings-nav>button{counter-increment:rrnSettingsNav}
      .settings-nav>button>:scope:first-child{font-size:0!important}
      .settings-nav>button>:scope:first-child::after{content:counter(rrnSettingsNav,decimal-leading-zero);font-size:.7rem!important}
      .settings-agent-grid{display:grid;grid-template-columns:1fr;gap:16px}
      .settings-agent-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:14px}
      .settings-agent-code{display:block;margin:14px 0 8px;padding:11px 13px;border-radius:11px;background:var(--rrn-surface-soft,#eef2f3);font-weight:800;letter-spacing:.04em;word-break:break-all}
      .settings-agent-command{width:100%;min-height:105px;resize:vertical;border:1px solid var(--rrn-border);border-radius:11px;background:var(--rrn-input,#fff);color:var(--rrn-text);padding:11px;font:500 .76rem/1.5 ui-monospace,SFMono-Regular,Consolas,monospace}
      .settings-agent-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:13px 0}
      .settings-agent-summary div{padding:11px;border:1px solid var(--rrn-border);border-radius:11px;background:var(--rrn-surface-soft)}
      .settings-agent-summary span,.settings-agent-summary small{display:block;color:var(--rrn-muted)}
      .settings-agent-summary strong{display:block;margin:3px 0;color:var(--rrn-heading);font-size:1.35rem}
      .settings-agent-list{display:grid;gap:10px}
      .settings-agent-device{min-width:0;padding:15px;border:1px solid var(--rrn-border);border-radius:14px;background:var(--rrn-surface-2,#fff)}
      .settings-agent-device-top{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:start}
      .settings-agent-title{min-width:0}.settings-agent-title strong{display:block;overflow-wrap:anywhere;color:var(--rrn-heading);font-size:.9rem}.settings-agent-title small{display:block;margin-top:3px;color:var(--rrn-muted)}
      .settings-agent-pill{display:inline-flex;width:max-content;padding:4px 8px;border-radius:999px;font-size:.68rem;font-weight:800;white-space:nowrap}
      .settings-agent-pill.ok{background:rgba(47,125,120,.14);color:var(--rrn-secondary)}.settings-agent-pill.warn{background:rgba(217,119,69,.14);color:var(--rrn-accent)}.settings-agent-pill.off{background:rgba(190,70,70,.12);color:var(--rrn-danger,#be4646)}
      .settings-agent-meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:12px}
      .settings-agent-meta>div{min-width:0;padding:10px;border:1px solid var(--rrn-border);border-radius:10px;background:var(--rrn-surface-soft)}
      .settings-agent-meta span{display:block;color:var(--rrn-muted);font-size:.63rem;font-weight:700}.settings-agent-meta strong{display:block;margin-top:3px;overflow-wrap:anywhere;color:var(--rrn-heading);font-size:.75rem}
      .settings-agent-linked{margin-top:11px;padding:10px 11px;border-radius:10px;background:var(--rrn-surface-soft);color:var(--rrn-muted);font-size:.7rem;line-height:1.45}.settings-agent-linked b{color:var(--rrn-heading)}
      .settings-agent-link{display:grid;grid-template-columns:minmax(260px,1fr) auto auto auto;gap:8px;align-items:end;margin-top:11px}
      .settings-agent-link label{display:grid;gap:5px;color:var(--rrn-muted);font-size:.68rem;font-weight:700}.settings-agent-link select{width:100%;min-height:40px;padding:7px 9px;border:1px solid var(--rrn-border);border-radius:9px;background:var(--rrn-input,#fff);color:var(--rrn-text)}
      .settings-agent-empty{padding:18px;border:1px dashed var(--rrn-border);border-radius:13px;color:var(--rrn-muted);text-align:center}
      .settings-agent-loading{opacity:.62;pointer-events:none}
      @media(max-width:780px){.settings-agent-summary{grid-template-columns:1fr}.settings-agent-meta{grid-template-columns:1fr}.settings-agent-link{grid-template-columns:1fr}.settings-agent-link button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function mount() {
    if (state.mounted || !canManage()) return false;
    const nav = document.querySelector('.settings-nav');
    const content = document.querySelector('.settings-content');
    if (!nav || !content) return false;

    injectStyle();
    document.querySelectorAll('[data-settings-agent-nav],[data-settings-agent-panel]').forEach(node => node.remove());
    document.querySelector('[data-settings-nav="agent"]')?.remove();
    document.querySelectorAll('[data-settings-panel="agent"]').forEach(node => node.remove());

    const adminNav = document.getElementById('settingsAdminNav');
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.settingsNav = 'agent';
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', 'false');
    button.innerHTML = '<span>05</span><div><strong>Agente RRN</strong><small>Vinculação e inventário Windows</small></div>';
    nav.insertBefore(button, adminNav || null);

    const panel = document.createElement('section');
    panel.className = 'settings-panel';
    panel.dataset.settingsPanel = 'agent';
    panel.setAttribute('role', 'tabpanel');
    panel.hidden = true;
    content.appendChild(panel);

    button.addEventListener('click', activate);
    state.mounted = true;
    render();
    if (location.hash.toLowerCase() === '#agent') activate();
    return true;
  }

  function activate() {
    if (!state.mounted && !mount()) return;
    document.querySelectorAll('[data-settings-nav]').forEach(button => {
      const active = button.dataset.settingsNav === 'agent';
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('[data-settings-panel]').forEach(panel => {
      const active = panel.dataset.settingsPanel === 'agent';
      panel.classList.toggle('active', active);
      panel.hidden = !active;
    });
    history.replaceState(null, '', '#agent');
    window.scrollTo({ top: 0, behavior: 'auto' });
    refreshDevices();
  }

  function candidateOptions(device) {
    const currentId = String(device.id);
    const rows = state.candidates.filter(row => !row.asset?.agentDeviceId || String(row.asset.agentDeviceId) === currentId);
    return ['<option value="">Selecione uma máquina...</option>', ...rows.map(row => {
      const label = [row.sectorName, row.label, row.asset?.modelo].filter(Boolean).join(' · ');
      return `<option value="${esc(row.key)}">${esc(label)}</option>`;
    })].join('');
  }

  function render() {
    const panel = document.querySelector('[data-settings-panel="agent"]');
    if (!panel) return;
    state.candidates = inventoryCandidates();
    const recent = state.devices.filter(item => ageHours(item.last_seen_at) <= 14).length;
    const stale = state.devices.filter(item => ageHours(item.last_seen_at) > 36).length;

    panel.classList.toggle('settings-agent-loading', state.refreshing);
    panel.innerHTML = `
      <div class="settings-page-heading"><span class="settings-eyebrow">Agente RRN</span><h1>Vinculação de máquinas</h1><p>Instale o agente, associe o computador ao equipamento correto e acompanhe a última comunicação.</p></div>
      <div class="settings-agent-grid">
        <article class="settings-card">
          <div class="settings-card-head"><div><h2>Instalar agente Windows</h2><p>O instalador cadastra a máquina e adiciona o aplicativo perto do relógio.</p></div><span class="settings-card-badge settings-card-badge-ok">Windows</span></div>
          ${state.token ? `<code class="settings-agent-code">${esc(state.token.enrollment_code)}</code><textarea class="settings-agent-command" readonly>${esc(state.command)}</textarea><small>Código válido até ${esc(formatDate(state.token.expires_at))}.</small>` : '<div class="settings-agent-empty">Gere um código temporário para instalar em uma máquina.</div>'}
          <div class="settings-agent-actions"><button type="button" class="settings-primary-btn" data-agent-generate>Gerar código</button>${state.token ? '<button type="button" class="settings-ghost-btn" data-agent-copy>Copiar comando</button>' : ''}<a class="settings-ghost-btn" href="${ZIP_URL}" target="_blank" rel="noopener">Baixar pacote Windows</a></div>
        </article>
        <article class="settings-card">
          <div class="settings-card-head"><div><h2>Máquinas com agente</h2><p>Vincule, desvincule ou remova um agente sem duplicar o inventário.</p></div><button type="button" class="settings-ghost-btn" data-agent-refresh>${state.refreshing ? 'Atualizando...' : 'Atualizar lista'}</button></div>
          <div class="settings-agent-summary"><div><span>Agentes</span><strong>${state.devices.length}</strong><small>registrados</small></div><div><span>Atualizados</span><strong>${recent}</strong><small>≤ 14 horas</small></div><div><span>Sem comunicação</span><strong>${stale}</strong><small>&gt; 36 horas</small></div></div>
          <div class="settings-agent-list">${state.devices.length ? state.devices.map(deviceCard).join('') : '<div class="settings-agent-empty">Nenhum agente registrado.</div>'}</div>
        </article>
      </div>`;

    panel.querySelector('[data-agent-generate]')?.addEventListener('click', generateToken);
    panel.querySelector('[data-agent-copy]')?.addEventListener('click', () => copyText(state.command));
    panel.querySelector('[data-agent-refresh]')?.addEventListener('click', refreshDevices);
    panel.querySelectorAll('[data-agent-device]').forEach(card => {
      const id = card.dataset.agentDevice;
      card.querySelector('[data-agent-link]')?.addEventListener('click', () => linkDevice(id, card.querySelector('[data-agent-link-select]')?.value));
      card.querySelector('[data-agent-unlink]')?.addEventListener('click', () => unlinkDevice(id));
      card.querySelector('[data-agent-delete]')?.addEventListener('click', () => deleteDevice(id));
    });
  }

  function deviceCard(device) {
    const [cls, label] = deviceStatus(device);
    const link = device.metadata?.inventory_link || null;
    return `<div class="settings-agent-device" data-agent-device="${esc(device.id)}">
      <div class="settings-agent-device-top">
        <div class="settings-agent-title"><strong>${esc(device.hostname || device.serial_number || 'Dispositivo')}</strong><small>${esc([device.manufacturer, device.model].filter(Boolean).join(' ') || device.equipment_type || 'Computador')}</small></div>
        <span class="settings-agent-pill ${cls}">${label}</span>
      </div>
      <div class="settings-agent-meta">
        <div><span>Serial / patrimônio</span><strong>${esc(device.serial_number || device.asset_tag || 'Não informado')}</strong></div>
        <div><span>Última comunicação</span><strong>${esc(formatDate(device.last_seen_at))} · agente ${esc(device.agent_version || '—')}</strong></div>
      </div>
      <div class="settings-agent-linked">${link?.label ? `Vinculado a <b>${esc(link.label)}</b>${link.sector ? ` · ${esc(link.sector)}` : ''}` : '<b>Ainda não vinculado a uma máquina existente.</b> Até a vinculação, ele permanece no fluxo de estoque.'}</div>
      <div class="settings-agent-link">
        <label>Máquina do inventário<select data-agent-link-select>${candidateOptions(device)}</select></label>
        <button type="button" class="settings-primary-btn" data-agent-link>Vincular</button>
        ${link?.label ? '<button type="button" class="settings-ghost-btn" data-agent-unlink>Desvincular</button>' : ''}
        <button type="button" class="settings-danger-btn" data-agent-delete>Remover agente</button>
      </div>
    </div>`;
  }

  async function generateToken() {
    const db = client();
    if (!db) return alert('Backend do RRN indisponível.');
    try {
      const { data, error } = await db.rpc('create_agent_enrollment_token', { p_expires_hours: 24, p_max_uses: 25 });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.enrollment_code) throw new Error('O backend não retornou o código.');
      state.token = row;
      state.command = commandFor(row.enrollment_code);
      render();
    } catch (error) {
      console.error('RRN Agent token:', error);
      alert(error?.message || 'Não foi possível gerar o código.');
    }
  }

  async function refreshDevices() {
    if (state.refreshing) return;
    const db = client();
    if (!db) return;
    state.refreshing = true;
    render();
    try {
      const { data, error } = await db.from('agent_devices')
        .select('id,hostname,equipment_type,serial_number,asset_tag,manufacturer,model,agent_version,last_seen_at,status,metadata')
        .order('last_seen_at', { ascending: false }).limit(300);
      if (error) throw error;
      state.devices = Array.isArray(data) ? data : [];
    } catch (error) {
      console.warn('RRN Agent refresh:', error);
    } finally {
      state.refreshing = false;
      render();
    }
  }

  function clearLocalLink(deviceId, removeAgentStock = false) {
    const setores = readArray('setores');
    setores.forEach(sector => (sector.maquinas || []).forEach(asset => {
      if (String(asset?.agentDeviceId || '') !== String(deviceId)) return;
      delete asset.agentDeviceId; delete asset.agentHostname; delete asset.agentLinkedAt;
    }));
    writeArray('setores', setores);

    const stock = [];
    readArray('rrn_stock_assets').forEach(asset => {
      const matches = String(asset?.agentDeviceId || '') === String(deviceId);
      const agentCreated = String(asset?.origemEstoque || '').toLowerCase() === 'rrn-agent';
      if (matches && agentCreated && removeAgentStock) return;
      if (matches && !agentCreated) {
        delete asset.agentDeviceId; delete asset.agentHostname; delete asset.agentLinkedAt;
      }
      stock.push(asset);
    });
    writeArray('rrn_stock_assets', stock);
  }

  async function linkDevice(deviceId, candidateKey) {
    const target = state.candidates.find(row => row.key === candidateKey);
    const device = state.devices.find(row => String(row.id) === String(deviceId));
    if (!target || !device) return alert('Selecione uma máquina do inventário.');

    clearLocalLink(deviceId, true);
    if (target.source === 'sector') {
      const setores = readArray('setores');
      const asset = setores[target.sectorIndex]?.maquinas?.[target.assetIndex];
      if (!asset) return alert('A máquina selecionada não está mais disponível.');
      asset.agentDeviceId = deviceId; asset.agentHostname = device.hostname || ''; asset.agentLinkedAt = new Date().toISOString();
      writeArray('setores', setores);
    } else {
      const stock = readArray('rrn_stock_assets');
      const asset = stock[target.stockIndex];
      if (!asset) return alert('A máquina selecionada não está mais disponível.');
      asset.agentDeviceId = deviceId; asset.agentHostname = device.hostname || ''; asset.agentLinkedAt = new Date().toISOString();
      writeArray('rrn_stock_assets', stock);
    }

    try {
      const { error } = await client().rpc('link_agent_device_inventory', {
        p_device_id: deviceId,
        p_inventory_key: target.key,
        p_inventory_label: target.label,
        p_sector_name: target.sectorName
      });
      if (error) throw error;
      window.dispatchEvent(new CustomEvent('rrn:stock-update'));
      await refreshDevices();
      alert('Máquina vinculada com sucesso.');
    } catch (error) {
      console.error('RRN Agent link:', error);
      alert(error?.message || 'Não foi possível salvar a vinculação.');
    }
  }

  async function unlinkDevice(deviceId) {
    if (!confirm('Desvincular este agente da máquina do inventário?')) return;
    clearLocalLink(deviceId, false);
    try {
      const { error } = await client().rpc('unlink_agent_device_inventory', { p_device_id: deviceId });
      if (error) throw error;
      await refreshDevices();
    } catch (error) {
      alert(error?.message || 'Não foi possível desvincular.');
    }
  }

  async function deleteDevice(deviceId) {
    if (!confirm('Remover este agente do RRN Manager? Para voltar a aparecer, o computador precisará ser vinculado novamente.')) return;
    const db = client();
    if (!db) return alert('Backend do RRN indisponível.');
    try {
      const { error } = await db.rpc('delete_agent_device_inventory', { p_device_id: deviceId });
      if (error) throw error;
      clearLocalLink(deviceId, true);
      window.dispatchEvent(new CustomEvent('rrn:stock-update'));
      await refreshDevices();
    } catch (error) {
      console.error('RRN Agent delete:', error);
      alert(error?.message || 'Não foi possível remover o agente.');
    }
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); }
    catch { prompt('Copie o comando:', text); }
  }

  function boot() {
    mount();
    window.addEventListener('rrn:session-ready', () => mount(), { once: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
