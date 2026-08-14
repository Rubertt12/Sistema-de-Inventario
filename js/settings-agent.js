(() => {
  'use strict';
  if (window.__RRN_SETTINGS_AGENT__) return;
  window.__RRN_SETTINGS_AGENT__ = true;

  const RELEASE_ZIP = 'https://github.com/Rubertt12/Sistema-de-Inventario/releases/download/rrn-agent-latest/RRN-Agent-Windows-x64.zip';
  const state = { devices: [], token: null, command: '', loading: false };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function role() {
    if (window.RRN_SESSION?.role) return String(window.RRN_SESSION.role).toLowerCase();
    try { return String(JSON.parse(localStorage.getItem('usuarioLogado') || '{}').perfil || '').toLowerCase(); }
    catch { return ''; }
  }

  function canManage() { return ['admin','operador'].includes(role()); }

  function client() {
    const cfg = window.RRN_SUPABASE || {};
    if (window.RRN_SUPABASE_CLIENT) return window.RRN_SUPABASE_CLIENT;
    if (!window.supabase?.createClient || !cfg.url || !cfg.anonKey) return null;
    window.RRN_SUPABASE_CLIENT = window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true } });
    return window.RRN_SUPABASE_CLIENT;
  }

  function commandFor(code) {
    const scriptUrl = `${location.origin}/agent/install.ps1`;
    return `$p = Join-Path $env:TEMP 'rrn-install.ps1'; Invoke-WebRequest '${scriptUrl}' -OutFile $p; powershell.exe -NoProfile -ExecutionPolicy Bypass -File $p -EnrollmentCode '${code}'`;
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
    if (document.getElementById('rrnSettingsAgentStyle')) return;
    const style = document.createElement('style');
    style.id = 'rrnSettingsAgentStyle';
    style.textContent = `
      .settings-agent-grid{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.4fr);gap:18px}
      .settings-agent-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
      .settings-agent-code{display:block;margin:14px 0 8px;padding:12px 14px;border-radius:12px;background:var(--rrn-surface-soft,#eef2f3);font-weight:800;letter-spacing:.04em;word-break:break-all}
      .settings-agent-command{width:100%;min-height:120px;resize:vertical;border:1px solid var(--rrn-border);border-radius:12px;background:var(--rrn-input,#fff);color:var(--rrn-text);padding:12px;font:500 .78rem/1.5 ui-monospace,SFMono-Regular,Consolas,monospace}
      .settings-agent-list{display:grid;gap:10px;margin-top:14px}
      .settings-agent-device{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,.9fr) minmax(0,.9fr);gap:12px;padding:14px;border:1px solid var(--rrn-border);border-radius:14px;background:var(--rrn-surface-2,#fff)}
      .settings-agent-device strong,.settings-agent-device small{display:block}.settings-agent-device small{color:var(--rrn-muted);margin-top:4px}
      .settings-agent-pill{display:inline-flex!important;width:max-content;margin-top:7px!important;padding:4px 8px;border-radius:999px;font-size:.72rem;font-weight:800}.settings-agent-pill.ok{background:rgba(47,125,120,.14);color:var(--rrn-secondary)}.settings-agent-pill.warn{background:rgba(217,119,69,.14);color:var(--rrn-accent)}.settings-agent-pill.off{background:rgba(190,70,70,.12);color:var(--rrn-danger,#be4646)}
      .settings-agent-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}.settings-agent-summary div{padding:12px;border-radius:12px;background:var(--rrn-surface-soft);border:1px solid var(--rrn-border)}.settings-agent-summary span,.settings-agent-summary small{display:block;color:var(--rrn-muted)}.settings-agent-summary strong{display:block;font-size:1.4rem;color:var(--rrn-heading);margin:3px 0}
      .settings-agent-empty{padding:18px;border:1px dashed var(--rrn-border);border-radius:14px;color:var(--rrn-muted);text-align:center}
      @media(max-width:860px){.settings-agent-grid{grid-template-columns:1fr}.settings-agent-device{grid-template-columns:1fr}.settings-agent-summary{grid-template-columns:1fr 1fr}}
      @media(max-width:520px){.settings-agent-summary{grid-template-columns:1fr}.settings-agent-actions>*{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function injectUi() {
    if (!canManage() || document.querySelector('[data-settings-agent-nav]')) return false;
    injectStyle();
    const nav = document.querySelector('.settings-nav');
    const content = document.querySelector('.settings-content');
    if (!nav || !content) return false;

    const adminNav = document.getElementById('settingsAdminNav');
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.settingsAgentNav = 'agent';
    button.setAttribute('role','tab');
    button.setAttribute('aria-selected','false');
    button.innerHTML = '<span>05</span><div><strong>Agente RRN</strong><small>Windows e inventário automático</small></div>';
    nav.insertBefore(button, adminNav || null);
    if (adminNav) adminNav.querySelector('span').textContent = '06';

    const panel = document.createElement('section');
    panel.className = 'settings-panel';
    panel.dataset.settingsAgentPanel = 'agent';
    panel.hidden = true;
    content.appendChild(panel);

    button.addEventListener('click', () => activate());
    render();
    if (location.hash.toLowerCase() === '#agent') activate();
    return true;
  }

  function activate() {
    document.querySelectorAll('[data-settings-nav]').forEach(btn => {
      btn.classList.remove('active');
      btn.setAttribute('aria-selected','false');
    });
    document.querySelectorAll('[data-settings-panel]').forEach(panel => { panel.classList.remove('active'); panel.hidden = true; });
    const button = document.querySelector('[data-settings-agent-nav]');
    const panel = document.querySelector('[data-settings-agent-panel]');
    if (!button || !panel) return;
    button.classList.add('active');
    button.setAttribute('aria-selected','true');
    panel.classList.add('active');
    panel.hidden = false;
    history.replaceState(null,'','#agent');
    window.scrollTo({ top:0, behavior:'smooth' });
    refreshDevices();
  }

  function render() {
    const panel = document.querySelector('[data-settings-agent-panel]');
    if (!panel) return;
    const devices = state.devices;
    const recent = devices.filter(d => ageHours(d.last_seen_at) <= 14).length;
    const stale = devices.filter(d => ageHours(d.last_seen_at) > 36).length;
    panel.innerHTML = `
      <div class="settings-page-heading"><span class="settings-eyebrow">Agente RRN</span><h1>Inventário automático do Windows</h1><p>Instale o RRN Agent para cadastrar a máquina, manter inventário de hardware e sincronizar automaticamente às 08:00 e 18:00.</p></div>
      <div class="settings-agent-grid">
        <article class="settings-card">
          <div class="settings-card-head"><div><h2>Instalar em uma máquina</h2><p>Gere um código temporário e execute o comando no PowerShell. O instalador também adiciona o ícone do RRN perto do relógio.</p></div><span class="settings-card-badge settings-card-badge-ok">Windows</span></div>
          ${state.token ? `<code class="settings-agent-code">${esc(state.token.enrollment_code)}</code><textarea class="settings-agent-command" readonly data-agent-command>${esc(state.command)}</textarea><div class="settings-agent-note">Código válido até ${esc(formatDate(state.token.expires_at))}.</div>` : '<div class="settings-agent-empty">Gere um código para preparar a instalação.</div>'}
          <div class="settings-agent-actions"><button type="button" class="settings-primary-btn" data-agent-generate>Gerar código</button>${state.token ? '<button type="button" class="settings-ghost-btn" data-agent-copy>Copiar comando</button>' : ''}<a class="settings-ghost-btn" href="${RELEASE_ZIP}" target="_blank" rel="noopener">Baixar pacote Windows</a></div>
          <div class="settings-info-box" style="margin-top:16px"><strong>Aplicativo da bandeja</strong><p>Depois da instalação, a logo do RRN aparece perto do relógio com opções para sincronizar agora, atualizar o agente, abrir o sistema e sair da interface.</p></div>
        </article>
        <article class="settings-card">
          <div class="settings-card-head"><div><h2>Máquinas com agente</h2><p>Última comunicação e identificação dos computadores vinculados.</p></div><button type="button" class="settings-ghost-btn" data-agent-refresh>Atualizar lista</button></div>
          <div class="settings-agent-summary"><div><span>Vinculados</span><strong>${devices.length}</strong><small>dispositivos</small></div><div><span>Atualizados</span><strong>${recent}</strong><small>≤ 14 horas</small></div><div><span>Sem comunicação</span><strong>${stale}</strong><small>&gt; 36 horas</small></div></div>
          <div class="settings-agent-list">${devices.length ? devices.map(device => { const [cls,label] = status(device); return `<div class="settings-agent-device"><div><strong>${esc(device.hostname || device.serial_number || 'Dispositivo')}</strong><small>${esc([device.manufacturer,device.model].filter(Boolean).join(' ') || device.equipment_type || 'Computador')}</small><span class="settings-agent-pill ${cls}">${label}</span></div><div><strong>${esc(device.serial_number || device.asset_tag || '—')}</strong><small>Serial / patrimônio</small></div><div><strong>${esc(formatDate(device.last_seen_at))}</strong><small>Última comunicação · agente ${esc(device.agent_version || '—')}</small></div></div>`; }).join('') : '<div class="settings-agent-empty">Nenhum agente vinculado ainda.</div>'}</div>
        </article>
      </div>`;

    panel.querySelector('[data-agent-generate]')?.addEventListener('click', generateToken);
    panel.querySelector('[data-agent-copy]')?.addEventListener('click', () => copyText(state.command));
    panel.querySelector('[data-agent-refresh]')?.addEventListener('click', refreshDevices);
  }

  async function generateToken() {
    const db = client();
    if (!db) return alert('Backend do RRN indisponível.');
    try {
      const { data, error } = await db.rpc('create_agent_enrollment_token', { p_expires_hours:24, p_max_uses:25 });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.enrollment_code) throw new Error('O backend não retornou o código.');
      state.token = row;
      state.command = commandFor(row.enrollment_code);
      render();
    } catch (error) {
      console.error('RRN Agent settings:', error);
      alert(error?.message || 'Não foi possível gerar o código de instalação.');
    }
  }

  async function refreshDevices() {
    const db = client();
    if (!db) return;
    try {
      const { data, error } = await db.from('agent_devices').select('id,hostname,equipment_type,serial_number,asset_tag,manufacturer,model,agent_version,last_seen_at,status').order('last_seen_at',{ascending:false}).limit(300);
      if (error) throw error;
      state.devices = Array.isArray(data) ? data : [];
      render();
    } catch (error) {
      console.warn('RRN Agent settings:', error);
    }
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); }
    catch { prompt('Copie o comando:', text); }
  }

  function boot() {
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (injectUi() || tries > 100) clearInterval(timer);
    }, 100);
    window.addEventListener('rrn:session-ready', () => injectUi(), { once:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
