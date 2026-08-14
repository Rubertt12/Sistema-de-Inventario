(() => {
  'use strict';
  if (window.__RRN_SETTINGS_AGENT_V2__) return;
  window.__RRN_SETTINGS_AGENT_V2__ = true;

  const RELEASE_BASE = 'https://github.com/Rubertt12/Sistema-de-Inventario/releases/download/rrn-agent-latest';
  const INSTALL_URL = `${RELEASE_BASE}/install.ps1`;
  const ZIP_URL = `${RELEASE_BASE}/RRN-Agent-Windows-x64.zip`;
  const state = { devices: [], token: null, command: '', candidates: [] };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
  const norm = value => String(value ?? '').trim();

  function sessionRole() {
    if (window.RRN_SESSION?.role) return String(window.RRN_SESSION.role).toLowerCase();
    try { return String(JSON.parse(localStorage.getItem('usuarioLogado') || '{}').perfil || '').toLowerCase(); }
    catch { return ''; }
  }

  function canManage() { return ['admin','operador'].includes(sessionRole()); }

  function db() {
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

  function identity(asset) {
    return norm(asset?.etiqueta || asset?.patrimonio || asset?.serial || asset?.numeroSerie || asset?.nome || asset?.hostname || 'Equipamento');
  }

  function inventoryCandidates() {
    const rows = [];
    const setores = readArray('setores');
    setores.forEach((sector, sectorIndex) => {
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
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR', { dateStyle:'short', timeStyle:'short' });
  }

  function ageHours(value) {
    const time = new Date(value || 0).getTime();
    return Number.isFinite(time) ? Math.max(0, (Date.now() - time) / 3600000) : Infinity;
  }

  function status(device) {
    const hours = ageHours(device.last_seen_at);
    if (hours <= 14) return ['ok','Atualizado'];
    if (hours <= 36) return ['warn','Atenção'];
    return ['off','Sem comunicação'];
  }

  function injectStyle() {
    if (document.getElementById('rrnSettingsAgentV2Style')) return;
    const style = document.createElement('style');
    style.id = 'rrnSettingsAgentV2Style';
    style.textContent = `
      .settings-agent-grid{display:grid;grid-template-columns:minmax(0,.88fr) minmax(0,1.45fr);gap:18px}
      .settings-agent-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:14px}
      .settings-agent-code{display:block;margin:14px 0 8px;padding:11px 13px;border-radius:11px;background:var(--rrn-surface-soft,#eef2f3);font-weight:800;letter-spacing:.04em;word-break:break-all}
      .settings-agent-command{width:100%;min-height:115px;resize:vertical;border:1px solid var(--rrn-border);border-radius:11px;background:var(--rrn-input,#fff);color:var(--rrn-text);padding:11px;font:500 .76rem/1.5 ui-monospace,SFMono-Regular,Consolas,monospace}
      .settings-agent-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin:13px 0}.settings-agent-summary div{padding:11px;border:1px solid var(--rrn-border);border-radius:11px;background:var(--rrn-surface-soft)}.settings-agent-summary span,.settings-agent-summary small{display:block;color:var(--rrn-muted)}.settings-agent-summary strong{display:block;margin:3px 0;color:var(--rrn-heading);font-size:1.35rem}
      .settings-agent-list{display:grid;gap:10px}.settings-agent-device{padding:14px;border:1px solid var(--rrn-border);border-radius:14px;background:var(--rrn-surface-2,#fff)}
      .settings-agent-device-head{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(120px,.65fr) auto;gap:12px;align-items:start}.settings-agent-device strong,.settings-agent-device small{display:block}.settings-agent-device small{margin-top:3px;color:var(--rrn-muted)}
      .settings-agent-pill{display:inline-flex!important;width:max-content;margin-top:7px!important;padding:4px 8px;border-radius:999px;font-size:.7rem;font-weight:800}.settings-agent-pill.ok{background:rgba(47,125,120,.14);color:var(--rrn-secondary)}.settings-agent-pill.warn{background:rgba(217,119,69,.14);color:var(--rrn-accent)}.settings-agent-pill.off{background:rgba(190,70,70,.12);color:var(--rrn-danger,#be4646)}
      .settings-agent-link{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;align-items:end;margin-top:13px;padding-top:12px;border-top:1px solid var(--rrn-border)}.settings-agent-link label{display:grid;gap:5px;color:var(--rrn-muted);font-size:.68rem;font-weight:700}.settings-agent-link select{width:100%;min-height:39px;padding:7px 9px;border:1px solid var(--rrn-border);border-radius:9px;background:var(--rrn-input,#fff);color:var(--rrn-text)}
      .settings-agent-linked{display:flex;flex-wrap:wrap;align-items:center;gap:7px;margin-top:9px;color:var(--rrn-muted);font-size:.68rem}.settings-agent-linked b{color:var(--rrn-heading)}
      .settings-agent-empty{padding:18px;border:1px dashed var(--rrn-border);border-radius:13px;color:var(--rrn-muted);text-align:center}
      @media(max-width:900px){.settings-agent-grid{grid-template-columns:1fr}.settings-agent-device-head{grid-template-columns:1fr 1fr}.settings-agent-device-head>div:last-child{grid-column:1/-1}.settings-agent-link{grid-template-columns:1fr auto auto}}
      @media(max-width:580px){.settings-agent-summary{grid-template-columns:1fr}.settings-agent-device-head,.settings-agent-link{grid-template-columns:1fr}.settings-agent-link button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function installPanel() {
    if (!canManage()) return false;
    if (document.querySelector('[data-settings-nav="agent"]')) return true;
    const nav = document.querySelector('.settings-nav');
    const content = document.querySelector('.settings-content');
    if (!nav || !content) return false;
    injectStyle();

    const adminNav = document.getElementById('settingsAdminNav');
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.settingsNav = 'agent';
    button.setAttribute('role','tab');
    button.setAttribute('aria-selected','false');
    button.innerHTML = '<span>05</span><div><strong>Agente RRN</strong><small>Vinculação e inventário Windows</small></div>';
    nav.insertBefore(button, adminNav || null);
    if (adminNav) adminNav.querySelector(':scope > span').textContent = '06';

    const panel = document.createElement('section');
    panel.className = 'settings-panel';
    panel.dataset.settingsPanel = 'agent';
    panel.setAttribute('role','tabpanel');
    panel.hidden = true;
    content.appendChild(panel);

    button.addEventListener('click', activate);
    if (location.hash.toLowerCase() === '#agent') setTimeout(activate, 50);
    render();
    return true;
  }

  function activate() {
    document.querySelectorAll('[data-settings-nav]').forEach(btn => {
      const active = btn.dataset.settingsNav === 'agent';
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('[data-settings-panel]').forEach(panel => {
      const active = panel.dataset.settingsPanel === 'agent';
      panel.classList.toggle('active', active);
      panel.hidden = !active;
    });
    history.replaceState(null,'','#agent');
    window.scrollTo({ top:0, behavior:'smooth' });
    refreshDevices();
  }

  function candidateOptions(device) {
    const currentId = String(device.id);
    const rows = state.candidates.filter(row => !row.asset?.agentDeviceId || String(row.asset.agentDeviceId) === currentId);
    return ['<option value="">Selecione uma máquina...</option>', ...rows.map(row => {
      const parts = [row.sectorName, row.label, row.asset?.modelo].filter(Boolean).join(' · ');
      return `<option value="${esc(row.key)}">${esc(parts)}</option>`;
    })].join('');
  }

  function render() {
    const panel = document.querySelector('[data-settings-panel="agent"]');
    if (!panel) return;
    state.candidates = inventoryCandidates();
    const devices = state.devices;
    const recent = devices.filter(d => ageHours(d.last_seen_at) <= 14).length;
    const stale = devices.filter(d => ageHours(d.last_seen_at) > 36).length;

    panel.innerHTML = `
      <div class="settings-page-heading"><span class="settings-eyebrow">Agente RRN</span><h1>Vinculação de máquinas</h1><p>Instale o agente, vincule cada computador ao equipamento correto do inventário e acompanhe a última comunicação.</p></div>
      <div class="settings-agent-grid">
        <article class="settings-card">
          <div class="settings-card-head"><div><h2>Instalar agente Windows</h2><p>O instalador cadastra a máquina e adiciona o aplicativo perto do relógio.</p></div><span class="settings-card-badge settings-card-badge-ok">Windows</span></div>
          ${state.token ? `<code class="settings-agent-code">${esc(state.token.enrollment_code)}</code><textarea class="settings-agent-command" readonly>${esc(state.command)}</textarea><small>Código válido até ${esc(formatDate(state.token.expires_at))}.</small>` : '<div class="settings-agent-empty">Gere um código temporário para instalar em uma máquina.</div>'}
          <div class="settings-agent-actions"><button type="button" class="settings-primary-btn" data-agent-generate>Gerar código</button>${state.token ? '<button type="button" class="settings-ghost-btn" data-agent-copy>Copiar comando</button>' : ''}<a class="settings-ghost-btn" href="${ZIP_URL}" target="_blank" rel="noopener">Baixar pacote Windows</a></div>
        </article>
        <article class="settings-card">
          <div class="settings-card-head"><div><h2>Agentes vinculados</h2><p>Associe o computador detectado à máquina correspondente do inventário.</p></div><button type="button" class="settings-ghost-btn" data-agent-refresh>Atualizar lista</button></div>
          <div class="settings-agent-summary"><div><span>Agentes</span><strong>${devices.length}</strong><small>registrados</small></div><div><span>Atualizados</span><strong>${recent}</strong><small>≤ 14 horas</small></div><div><span>Sem comunicação</span><strong>${stale}</strong><small>&gt; 36 horas</small></div></div>
          <div class="settings-agent-list">${devices.length ? devices.map(device => {
            const [cls,label] = status(device);
            const link = device.metadata?.inventory_link || null;
            return `<div class="settings-agent-device" data-agent-device="${esc(device.id)}">
              <div class="settings-agent-device-head">
                <div><strong>${esc(device.hostname || device.serial_number || 'Dispositivo')}</strong><small>${esc([device.manufacturer,device.model].filter(Boolean).join(' ') || device.equipment_type || 'Computador')}</small><span class="settings-agent-pill ${cls}">${label}</span></div>
                <div><strong>${esc(device.serial_number || device.asset_tag || 'Sem serial/tag')}</strong><small>Serial / patrimônio</small></div>
                <div><strong>${esc(formatDate(device.last_seen_at))}</strong><small>Última comunicação · agente ${esc(device.agent_version || '—')}</small></div>
              </div>
              <div class="settings-agent-linked">${link?.label ? `Vinculado a <b>${esc(link.label)}</b>${link.sector ? ` em ${esc(link.sector)}` : ''}` : '<b>Não vinculado a uma máquina existente.</b> Enquanto isso, ele permanece em Máquinas em estoque.'}</div>
              <div class="settings-agent-link">
                <label>Máquina do inventário<select data-agent-link-select>${candidateOptions(device)}</select></label>
                <button type="button" class="settings-primary-btn" data-agent-link>Vincular</button>
                ${link?.label ? '<button type="button" class="settings-ghost-btn" data-agent-unlink>Desvincular</button>' : ''}
              </div>
            </div>`;
          }).join('') : '<div class="settings-agent-empty">Nenhum agente registrado.</div>'}</div>
        </article>
      </div>`;

    panel.querySelector('[data-agent-generate]')?.addEventListener('click', generateToken);
    panel.querySelector('[data-agent-copy]')?.addEventListener('click', () => copyText(state.command));
    panel.querySelector('[data-agent-refresh]')?.addEventListener('click', refreshDevices);
    panel.querySelectorAll('[data-agent-device]').forEach(card => {
      const deviceId = card.dataset.agentDevice;
      card.querySelector('[data-agent-link]')?.addEventListener('click', () => linkDevice(deviceId, card.querySelector('[data-agent-link-select]')?.value));
      card.querySelector('[data-agent-unlink]')?.addEventListener('click', () => unlinkDevice(deviceId));
    });
  }

  async function generateToken() {
    const client = db();
    if (!client) return alert('Backend do RRN indisponível.');
    try {
      const { data, error } = await client.rpc('create_agent_enrollment_token', { p_expires_hours:24, p_max_uses:25 });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.enrollment_code) throw new Error('O backend não retornou o código.');
      state.token = row;
      state.command = commandFor(row.enrollment_code);
      render();
    } catch (error) { alert(error?.message || 'Não foi possível gerar o código.'); }
  }

  async function refreshDevices() {
    const client = db();
    if (!client) return;
    try {
      const { data, error } = await client.from('agent_devices')
        .select('id,hostname,equipment_type,serial_number,asset_tag,manufacturer,model,agent_version,last_seen_at,status,metadata')
        .order('last_seen_at',{ ascending:false }).limit(300);
      if (error) throw error;
      state.devices = Array.isArray(data) ? data : [];
      render();
    } catch (error) { console.warn('RRN Agent:', error); }
  }

  function removeDeviceIdEverywhere(deviceId) {
    const setores = readArray('setores');
    let changedSectors = false;
    setores.forEach(sector => (sector.maquinas || []).forEach(asset => {
      if (String(asset?.agentDeviceId || '') === String(deviceId)) {
        delete asset.agentDeviceId; delete asset.agentHostname; delete asset.agentLinkedAt;
        changedSectors = true;
      }
    }));
    if (changedSectors) localStorage.setItem('setores', JSON.stringify(setores));

    const stock = readArray('rrn_stock_assets');
    let changedStock = false;
    stock.forEach(asset => {
      if (String(asset?.agentDeviceId || '') === String(deviceId) && String(asset?.origemEstoque || '').toLowerCase() !== 'rrn-agent') {
        delete asset.agentDeviceId; delete asset.agentHostname; delete asset.agentLinkedAt;
        changedStock = true;
      }
    });
    if (changedStock) localStorage.setItem('rrn_stock_assets', JSON.stringify(stock));
  }

  async function linkDevice(deviceId, candidateKey) {
    const target = state.candidates.find(row => row.key === candidateKey);
    const device = state.devices.find(row => String(row.id) === String(deviceId));
    if (!target || !device) return alert('Selecione uma máquina do inventário.');

    removeDeviceIdEverywhere(deviceId);
    if (target.source === 'sector') {
      const setores = readArray('setores');
      const asset = setores[target.sectorIndex]?.maquinas?.[target.assetIndex];
      if (!asset) return alert('A máquina selecionada não está mais disponível. Atualize a página.');
      asset.agentDeviceId = deviceId;
      asset.agentHostname = device.hostname || '';
      asset.agentLinkedAt = new Date().toISOString();
      localStorage.setItem('setores', JSON.stringify(setores));
    } else {
      const stock = readArray('rrn_stock_assets');
      const asset = stock[target.stockIndex];
      if (!asset) return alert('A máquina selecionada não está mais disponível. Atualize a página.');
      asset.agentDeviceId = deviceId;
      asset.agentHostname = device.hostname || '';
      asset.agentLinkedAt = new Date().toISOString();
      localStorage.setItem('rrn_stock_assets', JSON.stringify(stock));
    }

    const stock = readArray('rrn_stock_assets').filter(asset => !(String(asset?.agentDeviceId || '') === String(deviceId) && String(asset?.origemEstoque || '').toLowerCase() === 'rrn-agent'));
    localStorage.setItem('rrn_stock_assets', JSON.stringify(stock));

    const client = db();
    try {
      const { error } = await client.rpc('link_agent_device_inventory', {
        p_device_id: deviceId,
        p_inventory_key: target.key,
        p_inventory_label: target.label,
        p_sector_name: target.sectorName
      });
      if (error) throw error;
      window.dispatchEvent(new CustomEvent('rrn:stock-update'));
      await refreshDevices();
      alert('Máquina vinculada ao RRN Agent com sucesso.');
    } catch (error) {
      console.error('RRN Agent link:', error);
      alert(error?.message || 'Não foi possível salvar a vinculação.');
    }
  }

  async function unlinkDevice(deviceId) {
    if (!confirm('Desvincular este agente da máquina do inventário? O agente continuará registrado.')) return;
    removeDeviceIdEverywhere(deviceId);
    try {
      const { error } = await db().rpc('unlink_agent_device_inventory', { p_device_id: deviceId });
      if (error) throw error;
      await refreshDevices();
    } catch (error) { alert(error?.message || 'Não foi possível desvincular.'); }
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); }
    catch { prompt('Copie o comando:', text); }
  }

  function boot() {
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (installPanel() || tries > 120) clearInterval(timer);
    }, 100);
    setTimeout(refreshDevices, 900);
    window.addEventListener('rrn:session-ready', () => { installPanel(); refreshDevices(); }, { once:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
