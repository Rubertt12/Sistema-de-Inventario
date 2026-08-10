(() => {
  'use strict';

  if (window.__RRN_DASHBOARD_TABS__) return;
  window.__RRN_DASHBOARD_TABS__ = true;

  const normalize = value => String(value ?? '').trim();
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function sectors() {
    try { if (typeof setores !== 'undefined' && Array.isArray(setores)) return setores; } catch {}
    try {
      const parsed = JSON.parse(localStorage.getItem('setores') || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  function assets() {
    return sectors().flatMap((sector, sectorIndex) => (Array.isArray(sector?.maquinas) ? sector.maquinas : []).map(asset => ({
      ...asset,
      __sectorName: sector?.nome || `Setor ${sectorIndex + 1}`
    })));
  }

  function historyItems() {
    try {
      const parsed = JSON.parse(localStorage.getItem('asset_history') || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  function parseDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function warrantySoon(asset) {
    const date = parseDate(asset?.garantiaAte);
    if (!date) return false;
    const diff = Math.ceil((date.getTime() - Date.now()) / 86400000);
    return diff >= 0 && diff <= 60;
  }

  function stats() {
    const allSectors = sectors();
    const allAssets = assets();
    return {
      sectors: allSectors.length,
      assets: allAssets.length,
      maintenance: allAssets.filter(asset => asset?.emManutencao).length,
      warranty: allAssets.filter(warrantySoon).length,
      assigned: allAssets.filter(asset => normalize(asset?.usuarioResponsavel)).length
    };
  }

  function typeBuckets() {
    const buckets = new Map();
    assets().forEach(asset => {
      const type = normalize(asset?.tipo) || 'Outros';
      buckets.set(type, (buckets.get(type) || 0) + 1);
    });
    return [...buckets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7);
  }

  function sessionInfo() {
    let compat = {};
    try { compat = JSON.parse(localStorage.getItem('usuarioLogado') || '{}'); } catch {}
    return {
      name: window.RRN_SESSION?.name || compat.nome || 'Usuário',
      tenant: window.RRN_SESSION?.tenantName || compat.tenant || 'Workspace',
      role: window.RRN_SESSION?.role || compat.perfil || null
    };
  }

  function ensureHome() {
    let home = document.getElementById('rrnDashboardHome');
    if (home) return home;

    home = document.createElement('section');
    home.id = 'rrnDashboardHome';
    home.className = 'rrn-dashboard-home';
    home.innerHTML = `
      <section class="rrn-home-hero">
        <div>
          <span class="rrn-home-eyebrow">Painel gerencial</span>
          <h2 data-home-title>Visão geral do inventário</h2>
          <p data-home-subtitle>Acompanhe ativos, setores, manutenção e movimentações sem precisar abrir cada setor.</p>
        </div>
        <div class="rrn-home-actions">
          <button type="button" class="rrn-home-action primary" data-home-action="inventory">Abrir inventário</button>
          <button type="button" class="rrn-home-action operador-only" data-home-action="add">＋ Novo setor</button>
          <button type="button" class="rrn-home-action operador-only" data-home-action="transfer">⇄ Transferir</button>
        </div>
      </section>
      <section class="rrn-kpi-grid" aria-label="Indicadores do inventário">
        <article class="rrn-kpi"><div class="rrn-kpi-top"><span>Equipamentos</span><span class="rrn-kpi-icon">🖥️</span></div><strong data-home-stat="assets">0</strong><small data-home-detail="assets">Ativos cadastrados</small></article>
        <article class="rrn-kpi"><div class="rrn-kpi-top"><span>Setores</span><span class="rrn-kpi-icon">🏢</span></div><strong data-home-stat="sectors">0</strong><small>Áreas com inventário</small></article>
        <article class="rrn-kpi warn"><div class="rrn-kpi-top"><span>Manutenção</span><span class="rrn-kpi-icon">🛠️</span></div><strong data-home-stat="maintenance">0</strong><small>Equipamentos indisponíveis</small></article>
        <article class="rrn-kpi warn"><div class="rrn-kpi-top"><span>Garantias</span><span class="rrn-kpi-icon">🛡️</span></div><strong data-home-stat="warranty">0</strong><small>Vencem nos próximos 60 dias</small></article>
      </section>
      <section class="rrn-home-grid">
        <article class="rrn-home-panel">
          <div class="rrn-home-panel-head"><div><h3>Distribuição por tipo</h3><small>Composição atual do inventário</small></div></div>
          <div class="rrn-type-list" data-home-types></div>
        </article>
        <article class="rrn-home-panel">
          <div class="rrn-home-panel-head"><div><h3>Atividade recente</h3><small>Últimas movimentações registradas</small></div></div>
          <div class="rrn-activity-list" data-home-activity></div>
        </article>
      </section>`;

    const anchor = document.querySelector('.dashboard-actions') || document.querySelector('main');
    if (anchor) anchor.parentNode.insertBefore(home, anchor);
    else document.body.appendChild(home);

    home.querySelector('[data-home-action="inventory"]')?.addEventListener('click', () => setTab('inventory'));
    home.querySelector('[data-home-action="add"]')?.addEventListener('click', () => {
      setTab('inventory');
      setTimeout(() => window.addSetor?.(), 50);
    });
    home.querySelector('[data-home-action="transfer"]')?.addEventListener('click', () => {
      setTab('inventory');
      setTimeout(() => window.abrirModalTransferencia?.(), 50);
    });
    return home;
  }

  function ensureTabs() {
    let host = document.querySelector('.rrn-app-tabs');
    if (host) return host;
    const nav = document.querySelector('.navbar .nav-links');
    if (!nav) return null;

    host = document.createElement('div');
    host.className = 'rrn-app-tabs';
    host.setAttribute('role', 'tablist');
    host.innerHTML = `
      <button type="button" class="rrn-app-tab" data-app-tab="dashboard" role="tab">Dashboard</button>
      <button type="button" class="rrn-app-tab" data-app-tab="inventory" role="tab">Setores e máquinas</button>`;
    const search = document.getElementById('searchInput');
    nav.insertBefore(host, search || nav.firstChild);
    host.querySelectorAll('[data-app-tab]').forEach(button => button.addEventListener('click', () => setTab(button.dataset.appTab)));
    return host;
  }

  function applyRole() {
    const role = sessionInfo().role;
    const canOperate = role === 'admin' || role === 'operador' || !role;
    document.querySelectorAll('#rrnDashboardHome .operador-only').forEach(el => { el.style.display = canOperate ? '' : 'none'; });
  }

  function renderTypes() {
    const host = ensureHome().querySelector('[data-home-types]');
    const buckets = typeBuckets();
    if (!buckets.length) {
      host.innerHTML = '<div class="rrn-home-empty">Ainda não há equipamentos suficientes para mostrar a distribuição.</div>';
      return;
    }
    const max = Math.max(...buckets.map(([, count]) => count), 1);
    host.innerHTML = buckets.map(([type, count]) => `
      <div class="rrn-type-row">
        <span title="${esc(type)}">${esc(type)}</span>
        <div class="rrn-type-track"><div class="rrn-type-fill" style="width:${Math.max(7, (count / max) * 100)}%"></div></div>
        <span class="rrn-type-value">${count}</span>
      </div>`).join('');
  }

  function activityLabel(event) {
    return event?.title || ({created:'Equipamento cadastrado', moved:'Equipamento transferido', deleted:'Item movido para a lixeira', restored:'Item restaurado', maintenance_started:'Manutenção iniciada', maintenance_released:'Equipamento liberado'}[event?.eventType] || event?.eventType || 'Alteração no inventário');
  }

  function renderActivity() {
    const host = ensureHome().querySelector('[data-home-activity]');
    const recent = historyItems().slice().reverse().slice(0, 6);
    if (!recent.length) {
      host.innerHTML = '<div class="rrn-home-empty">As próximas alterações do inventário aparecerão aqui.</div>';
      return;
    }
    host.innerHTML = recent.map(event => {
      const date = parseDate(event?.timestamp);
      const details = [event?.assetLabel || event?.entityId, event?.fromSector && event?.toSector ? `${event.fromSector} → ${event.toSector}` : (event?.toSector || event?.fromSector), date ? date.toLocaleString('pt-BR') : ''].filter(Boolean).join(' · ');
      return `<div class="rrn-activity"><span class="rrn-activity-dot"></span><div><strong>${esc(activityLabel(event))}</strong><small>${esc(details || 'Registro do inventário')}</small></div></div>`;
    }).join('');
  }

  function renderHome() {
    const home = ensureHome();
    const info = sessionInfo();
    const current = stats();
    home.querySelector('[data-home-title]').textContent = `Olá, ${info.name.split(' ')[0] || 'usuário'}`;
    home.querySelector('[data-home-subtitle]').textContent = `${info.tenant} · visão consolidada do ambiente e do inventário atual.`;
    Object.entries({assets:current.assets,sectors:current.sectors,maintenance:current.maintenance,warranty:current.warranty}).forEach(([key, value]) => {
      home.querySelector(`[data-home-stat="${key}"]`)?.replaceChildren(document.createTextNode(String(value)));
    });
    const detail = home.querySelector('[data-home-detail="assets"]');
    if (detail) detail.textContent = `${current.assigned} com usuário responsável`;
    renderTypes();
    renderActivity();
    applyRole();
  }

  function setTab(tab, updateHash = true) {
    const normalized = tab === 'inventory' ? 'inventory' : 'dashboard';
    ensureTabs();
    ensureHome();
    document.body.classList.toggle('rrn-tab-dashboard', normalized === 'dashboard');
    document.body.classList.toggle('rrn-tab-inventory', normalized === 'inventory');
    document.querySelectorAll('[data-app-tab]').forEach(button => {
      const active = button.dataset.appTab === normalized;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
    if (normalized === 'dashboard') renderHome();
    if (updateHash) history.replaceState(null, '', `${location.pathname}${location.search}#${normalized}`);
  }

  function initialTab() {
    return location.hash.toLowerCase() === '#inventory' || location.hash.toLowerCase() === '#inventario' ? 'inventory' : 'dashboard';
  }

  function boot() {
    ensureTabs();
    ensureHome();
    renderHome();
    setTab(initialTab(), false);

    window.addEventListener('hashchange', () => setTab(initialTab(), false));
    window.addEventListener('rrn:session-ready', () => { renderHome(); applyRole(); });
    window.addEventListener('storage', event => {
      if (['setores','asset_history'].includes(event.key)) renderHome();
    });

    const inventoryRoot = document.getElementById('setoresContainer');
    if (inventoryRoot) {
      let timer = null;
      new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(renderHome, 120);
      }).observe(inventoryRoot, { childList:true, subtree:true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();

  window.RRN_TABS = Object.freeze({ setTab, renderHome });
})();
