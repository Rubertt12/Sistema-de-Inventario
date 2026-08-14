(() => {
  'use strict';
  if (window.__RRN_AGENT_MANAGEMENT__) return;
  window.__RRN_AGENT_MANAGEMENT__ = true;

  const state = { devices: [], token: null, command: '', loading: false };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const siteBase = `${location.origin}`;

  function client() {
    const cfg = window.RRN_SUPABASE || {};
    if (window.RRN_SUPABASE_CLIENT) return window.RRN_SUPABASE_CLIENT;
    if (!window.supabase?.createClient || !cfg.url || !cfg.anonKey) return null;
    window.RRN_SUPABASE_CLIENT = window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true } });
    return window.RRN_SUPABASE_CLIENT;
  }

  function canManage() {
    return ['admin','operador'].includes(window.RRN_SESSION?.role || '');
  }

  function ensureView() {
    let view = document.getElementById('rrnAgentView');
    if (view) return view;
    view = document.createElement('section');
    view.id = 'rrnAgentView';
    view.className = 'rrn-agent-view';
    document.body.appendChild(view);
    return view;
  }

  function ensureTab() {
    if (!canManage()) return;
    const tabs = document.querySelector('.rrn-app-tabs');
    if (!tabs || tabs.querySelector('[data-app-tab="agents"]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rrn-app-tab';
    button.dataset.appTab = 'agents';
    button.dataset.rrnIcon = 'monitor';
    button.setAttribute('role','tab');
    button.textContent = 'Agentes RRN';
    button.addEventListener('click', openTab);
    tabs.appendChild(button);
    window.RRN_ICONS?.decorateStatic?.(button);
  }

  function closeMode() {
    document.body.classList.remove('rrn-tab-agents');
    const tab = document.querySelector('[data-app-tab="agents"]');
    tab?.classList.remove('is-active');
    tab?.setAttribute('aria-selected','false');
  }

  function wireOtherTabs() {
    document.querySelectorAll('[data-app-tab]:not([data-app-tab="agents"])').forEach(button => {
      if (button.dataset.rrnAgentCloseBound) return;
      button.dataset.rrnAgentCloseBound = '1';
      button.addEventListener('click', closeMode, true);
    });
  }

  async function openTab() {
    if (!canManage()) return;
    ensureView();
    document.body.classList.remove('rrn-tab-dashboard','rrn-tab-inventory','rrn-tab-stock');
    document.body.classList.add('rrn-tab-agents');
    document.querySelectorAll('[data-app-tab]').forEach(button => {
      const active = button.dataset.appTab === 'agents';
      button.classList.toggle('is-active',active);
      button.setAttribute('aria-selected',String(active));
    });
    history.replaceState(null,'',`${location.pathname}${location.search}#agents`);
    render();
    await refreshDevices();
  }

  function ageHours(value) {
    const time = new Date(value || 0).getTime();
    return Number.isFinite(time) ? Math.max(0,(Date.now()-time)/3600000) : Infinity;
  }

  function statusFor(device) {
    const hours = ageHours(device.last_seen_at);
    if (hours <= 14) return { cls:'ok', label:'Atualizado' };
    if (hours <= 36) return { cls:'warn', label:'Atenção' };
    return { cls:'off', label:'Sem comunicação' };
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
  }

  function locationLabel(device) {
    return [device.location_city,device.location_region,device.location_country].filter(Boolean).join(' · ') || 'Localização indisponível';
  }

  function commandFor(code) {
    const scriptUrl = `${siteBase}/agent/install.ps1`;
    return `powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=Join-Path $env:TEMP 'rrn-install.ps1'; Invoke-WebRequest '${scriptUrl}' -OutFile $p; & $p -EnrollmentCode '${code}'"`;
  }

  function render() {
    const view = ensureView();
    const devices = state.devices;
    const recent = devices.filter(d => ageHours(d.last_seen_at) <= 14).length;
    const stale = devices.filter(d => ageHours(d.last_seen_at) > 36).length;
    const located = devices.filter(d => d.location_city || (d.latitude != null && d.longitude != null)).length;
    const token = state.token;

    view.innerHTML = `
      <section class="rrn-agent-hero">
        <div><span class="rrn-agent-eyebrow">Inventário automatizado</span><h2>Agentes RRN</h2><p>Instale o agente nas máquinas Windows para enviar inventário automaticamente, registrar a última comunicação e adicionar novos equipamentos ao estoque da TI.</p></div>
        <div class="rrn-agent-hero-actions"><button type="button" class="rrn-agent-btn" data-agent-refresh>Atualizar lista</button><button type="button" class="rrn-agent-btn primary" data-agent-generate>Gerar código de instalação</button></div>
      </section>
      <section class="rrn-agent-kpis">
        <article class="rrn-agent-kpi"><span>Agentes vinculados</span><strong>${devices.length}</strong></article>
        <article class="rrn-agent-kpi"><span>Atualizados ≤ 14h</span><strong>${recent}</strong></article>
        <article class="rrn-agent-kpi"><span>Sem comunicação > 36h</span><strong>${stale}</strong></article>
        <article class="rrn-agent-kpi"><span>Com localização</span><strong>${located}</strong></article>
      </section>
      <section class="rrn-agent-grid">
        <article class="rrn-agent-panel">
          <h3>Instalar em uma máquina</h3>
          <p>Gere um código temporário, abra o PowerShell na máquina como administrador e execute o comando. O inventário inicial entra no estoque automaticamente.</p>
          ${token ? `<code class="rrn-agent-code">${esc(token.enrollment_code)}</code><textarea class="rrn-agent-command" readonly data-agent-command>${esc(state.command)}</textarea><div class="rrn-agent-copy-row"><button class="rrn-agent-btn" data-agent-copy-code>Copiar código</button><button class="rrn-agent-btn primary" data-agent-copy-command>Copiar comando</button></div><div class="rrn-agent-note">Código válido até ${esc(formatDate(token.expires_at))}. O agente enviará o inventário na instalação e depois às 08:00 e 18:00.</div>` : `<div class="rrn-agent-empty">Clique em <strong>Gerar código de instalação</strong> para preparar uma máquina nova.</div>`}
        </article>
        <article class="rrn-agent-panel">
          <h3>Máquinas monitoradas</h3>
          <p>Última comunicação, versão do agente e localização aproximada registrada pelo backend.</p>
          <div class="rrn-agent-list">
            ${devices.length ? devices.map(device => {
              const status = statusFor(device);
              return `<div class="rrn-agent-device">
                <div><strong>${esc(device.hostname || device.serial_number || 'Dispositivo')}</strong><small>${esc([device.manufacturer,device.model].filter(Boolean).join(' ') || device.equipment_type || 'Computador')}</small><span class="rrn-agent-status ${status.cls}">${status.label}</span></div>
                <div><small>Serial / patrimônio</small><strong>${esc(device.serial_number || device.asset_tag || '—')}</strong><small>${esc(device.asset_tag || '')}</small></div>
                <div><small>Última comunicação</small><strong>${esc(formatDate(device.last_seen_at))}</strong><small>Agente ${esc(device.agent_version || '—')}</small></div>
                <div><small>Última localização</small><strong>${esc(locationLabel(device))}</strong><small>${device.public_ip ? `IP ${esc(device.public_ip)}` : '—'}</small></div>
              </div>`;
            }).join('') : '<div class="rrn-agent-empty">Nenhum agente vinculado ainda.</div>'}
          </div>
        </article>
      </section>`;

    view.classList.toggle('rrn-agent-loading',state.loading);
    view.querySelector('[data-agent-refresh]')?.addEventListener('click',refreshDevices);
    view.querySelector('[data-agent-generate]')?.addEventListener('click',generateToken);
    view.querySelector('[data-agent-copy-code]')?.addEventListener('click',() => copyText(token?.enrollment_code || '', 'Código copiado.'));
    view.querySelector('[data-agent-copy-command]')?.addEventListener('click',() => copyText(state.command,'Comando de instalação copiado.'));
    window.RRN_ICONS?.decorateStatic?.(view);
  }

  async function refreshDevices() {
    const db = client();
    if (!db) return;
    state.loading = true; render();
    try {
      const { data, error } = await db.from('agent_devices').select('id,hostname,equipment_type,serial_number,asset_tag,manufacturer,model,agent_version,last_seen_at,public_ip,location_city,location_region,location_country,latitude,longitude,status').order('last_seen_at',{ascending:false}).limit(300);
      if (error) throw error;
      state.devices = Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('RRN Agent: falha ao listar dispositivos.',error);
      alert(error?.message || 'Não foi possível listar os agentes.');
    } finally {
      state.loading = false; render();
    }
  }

  async function generateToken() {
    const db = client();
    if (!db || !canManage()) return;
    state.loading = true; render();
    try {
      const { data, error } = await db.rpc('create_agent_enrollment_token',{p_expires_hours:24,p_max_uses:25});
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.enrollment_code) throw new Error('O backend não retornou o código de instalação.');
      state.token = row;
      state.command = commandFor(row.enrollment_code);
    } catch (error) {
      console.error('RRN Agent: falha ao gerar código.',error);
      alert(error?.message || 'Não foi possível gerar o código de instalação.');
    } finally {
      state.loading = false; render();
    }
  }

  async function copyText(text,message) {
    try { await navigator.clipboard.writeText(text); toast(message); }
    catch { prompt('Copie o conteúdo abaixo:',text); }
  }

  function toast(message) {
    const node = document.createElement('div');
    node.className = 'rrn-stock-toast';
    node.textContent = message;
    document.body.appendChild(node);
    setTimeout(() => node.remove(),2600);
  }

  function boot() {
    ensureView();
    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      ensureTab();
      wireOtherTabs();
      if ((document.querySelector('[data-app-tab="agents"]') && window.RRN_SESSION) || tries > 120) {
        if (location.hash.toLowerCase() === '#agents' && canManage()) openTab();
        if (tries > 120 || window.RRN_SESSION) clearInterval(timer);
      }
    },100);
    window.addEventListener('rrn:session-ready',() => { ensureTab(); wireOtherTabs(); if (location.hash.toLowerCase()==='#agents' && canManage()) openTab(); },{once:true});
  }

  window.RRN_AGENT_MANAGEMENT = Object.freeze({ open: openTab, refresh: refreshDevices });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
