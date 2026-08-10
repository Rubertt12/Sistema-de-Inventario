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
    return sectors().flatMap((sector, sectorIndex) => (Array.isArray(sector?.maquinas) ? sector.maquinas : []).map((asset, assetIndex) => ({
      ...asset,
      __sectorIndex: sectorIndex,
      __assetIndex: assetIndex,
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
    const raw = String(value).trim();
    let match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
      const parsed = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    const direct = new Date(raw);
    return Number.isNaN(direct.getTime()) ? null : direct;
  }

  function daysUntil(value) {
    const date = parseDate(value);
    if (!date) return null;
    const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
    return Math.ceil((end.getTime() - Date.now()) / 86400000);
  }

  function warrantySoon(asset) {
    const days = daysUntil(asset?.garantiaAte);
    return days != null && days >= 0 && days <= 60;
  }

  function assetState(asset) {
    if (asset?.emManutencao) return 'maintenance';
    const status = normalize(asset?.situacaoPatrimonial).toLowerCase();
    if (status.includes('estoque')) return 'stock';
    if (status.includes('emprest')) return 'borrowed';
    if (status.includes('baix') || status.includes('inativ')) return 'inactive';
    return 'operating';
  }

  function stats() {
    const allSectors = sectors();
    const allAssets = assets();
    const states = allAssets.reduce((acc, asset) => {
      const state = assetState(asset);
      acc[state] = (acc[state] || 0) + 1;
      return acc;
    }, {});
    return {
      sectors: allSectors.length,
      assets: allAssets.length,
      maintenance: states.maintenance || 0,
      warranty: allAssets.filter(warrantySoon).length,
      assigned: allAssets.filter(asset => normalize(asset?.usuarioResponsavel)).length,
      unassigned: allAssets.filter(asset => !normalize(asset?.usuarioResponsavel)).length,
      operating: states.operating || 0,
      stock: states.stock || 0,
      borrowed: states.borrowed || 0,
      inactive: states.inactive || 0
    };
  }

  function typeBuckets() {
    const buckets = new Map();
    assets().forEach(asset => {
      const raw = normalize(asset?.tipoMaquina || asset?.tipo) || 'Outros';
      const key = raw.charAt(0).toUpperCase() + raw.slice(1);
      buckets.set(key, (buckets.get(key) || 0) + 1);
    });
    return [...buckets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7);
  }

  function sectorBuckets() {
    return sectors()
      .map((sector, index) => {
        const list = Array.isArray(sector?.maquinas) ? sector.maquinas : [];
        return {
          index,
          name: normalize(sector?.nome) || `Setor ${index + 1}`,
          count: list.length,
          maintenance: list.filter(asset => asset?.emManutencao).length
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }

  function ticketPriority(asset) {
    const merged = [
      ...(Array.isArray(asset?.chamados) ? asset.chamados : []),
      ...(Array.isArray(asset?.chamado) ? asset.chamado : [])
    ];
    if (!merged.length) return 'Sem prioridade';
    const rank = { alta: 3, média: 2, media: 2, baixa: 1 };
    return merged
      .map(ticket => normalize(ticket?.prioridade) || 'Baixa')
      .sort((a, b) => (rank[b.toLowerCase()] || 0) - (rank[a.toLowerCase()] || 0))[0] || 'Baixa';
  }

  function maintenanceItems() {
    const rank = { alta: 3, média: 2, media: 2, baixa: 1, 'sem prioridade': 0 };
    return assets()
      .filter(asset => asset?.emManutencao)
      .map(asset => ({ ...asset, __priority: ticketPriority(asset) }))
      .sort((a, b) => (rank[b.__priority.toLowerCase()] || 0) - (rank[a.__priority.toLowerCase()] || 0))
      .slice(0, 5);
  }

  function warrantyItems() {
    return assets()
      .map(asset => ({ ...asset, __days: daysUntil(asset?.garantiaAte) }))
      .filter(asset => asset.__days != null && asset.__days >= 0 && asset.__days <= 60)
      .sort((a, b) => a.__days - b.__days)
      .slice(0, 5);
  }

  function assetLabel(asset) {
    return normalize(asset?.etiqueta || asset?.nome) || 'Equipamento sem identificação';
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

  function ensureStage2Style() {
    if (document.getElementById('rrn-dashboard-stage2-style')) return;
    const style = document.createElement('style');
    style.id = 'rrn-dashboard-stage2-style';
    style.textContent = `
      .rrn-health-strip{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin:0 0 14px}
      .rrn-health-item{display:flex;align-items:center;gap:9px;min-width:0;padding:10px 12px;border:1px solid rgba(41,89,145,.12);border-radius:11px;background:rgba(255,255,255,.58)}
      .rrn-health-icon{display:grid;flex:0 0 31px;width:31px;height:31px;place-items:center;border-radius:9px;background:rgba(41,89,145,.08);color:var(--rrn-blue)}
      .rrn-health-item:nth-child(2) .rrn-health-icon{background:rgba(242,191,79,.24)}
      .rrn-health-item:nth-child(3) .rrn-health-icon{background:rgba(237,158,245,.2)}
      .rrn-health-copy{min-width:0}.rrn-health-copy strong,.rrn-health-copy small{display:block}.rrn-health-copy strong{color:var(--rrn-blue);font-size:.78rem}.rrn-health-copy small{margin-top:1px;color:var(--rrn-muted);font-size:.61rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .rrn-sector-bars{display:flex;flex-direction:column;gap:10px}.rrn-sector-bar{display:grid;grid-template-columns:minmax(90px,150px) 1fr 42px;align-items:center;gap:9px;font-size:.7rem}.rrn-sector-bar-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:650;color:var(--rrn-ink)}
      .rrn-sector-track{height:9px;border-radius:999px;background:rgba(41,89,145,.09);overflow:hidden}.rrn-sector-fill{height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--rrn-blue),var(--rrn-pink))}.rrn-sector-bar-value{color:var(--rrn-blue);font-weight:800;text-align:right}.rrn-sector-maint{display:block;color:#9a6a08;font-size:.56rem;font-weight:700}
      .rrn-alert-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.rrn-alert-column{min-width:0}.rrn-alert-column h4{display:flex;align-items:center;gap:6px;margin:0 0 8px;color:var(--rrn-blue);font-size:.72rem}.rrn-alert-list{display:flex;flex-direction:column;gap:7px}
      .rrn-alert-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:9px 10px;border:1px solid rgba(41,89,145,.1);border-radius:10px;background:rgba(255,255,255,.62)}.rrn-alert-item strong,.rrn-alert-item small{display:block}.rrn-alert-item strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--rrn-ink);font-size:.66rem}.rrn-alert-item small{margin-top:2px;color:var(--rrn-muted);font-size:.57rem}.rrn-alert-action{display:inline-flex;align-items:center;justify-content:center;gap:4px;min-height:29px;padding:5px 8px;border:1px solid rgba(41,89,145,.18);border-radius:8px;background:#fff;color:var(--rrn-blue);font:inherit;font-size:.58rem;font-weight:800;cursor:pointer}.rrn-alert-action:hover{background:rgba(41,89,145,.06)}
      .rrn-priority{display:inline-block;margin-left:4px;padding:2px 5px;border-radius:99px;background:rgba(242,191,79,.23);color:#8a5d00;font-size:.53rem;font-weight:800}.rrn-warranty-days{color:#8a5d00;font-weight:800}
      .rrn-home-grid.rrn-secondary-grid{margin-top:14px}.rrn-home-panel.rrn-wide-alerts{grid-column:1/-1}
      .rrn-home-panel-title-icon{display:inline-grid;width:25px;height:25px;place-items:center;margin-right:6px;border-radius:7px;background:rgba(41,89,145,.08);color:var(--rrn-blue);vertical-align:middle}
      @media(max-width:930px){.rrn-health-strip{grid-template-columns:repeat(2,minmax(0,1fr))}.rrn-alert-grid{grid-template-columns:1fr}}
      @media(max-width:560px){.rrn-health-strip{grid-template-columns:1fr 1fr}.rrn-sector-bar{grid-template-columns:86px 1fr 34px}.rrn-alert-item{grid-template-columns:1fr}.rrn-alert-action{justify-self:start}}
    `;
    document.head.appendChild(style);
  }

  function ensureHome() {
    let home = document.getElementById('rrnDashboardHome');
    if (home) return home;

    ensureStage2Style();
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
          <button type="button" class="rrn-home-action primary" data-home-action="inventory" data-rrn-icon="inventory">Abrir inventário</button>
          <button type="button" class="rrn-home-action operador-only" data-home-action="add" data-rrn-icon="plus">Novo setor</button>
          <button type="button" class="rrn-home-action operador-only" data-home-action="transfer" data-rrn-icon="transfer">Transferir</button>
        </div>
      </section>
      <section class="rrn-kpi-grid" aria-label="Indicadores do inventário">
        <article class="rrn-kpi"><div class="rrn-kpi-top"><span>Equipamentos</span><span class="rrn-kpi-icon" data-rrn-icon="monitor"></span></div><strong data-home-stat="assets">0</strong><small data-home-detail="assets">Ativos cadastrados</small></article>
        <article class="rrn-kpi"><div class="rrn-kpi-top"><span>Setores</span><span class="rrn-kpi-icon" data-rrn-icon="building"></span></div><strong data-home-stat="sectors">0</strong><small>Áreas com inventário</small></article>
        <article class="rrn-kpi warn"><div class="rrn-kpi-top"><span>Manutenção</span><span class="rrn-kpi-icon" data-rrn-icon="wrench"></span></div><strong data-home-stat="maintenance">0</strong><small>Equipamentos indisponíveis</small></article>
        <article class="rrn-kpi warn"><div class="rrn-kpi-top"><span>Garantias</span><span class="rrn-kpi-icon" data-rrn-icon="shield"></span></div><strong data-home-stat="warranty">0</strong><small>Vencem nos próximos 60 dias</small></article>
      </section>
      <section class="rrn-health-strip" data-home-health></section>
      <section class="rrn-home-grid">
        <article class="rrn-home-panel">
          <div class="rrn-home-panel-head"><div><h3>Equipamentos por setor</h3><small>Distribuição do parque por área</small></div></div>
          <div class="rrn-sector-bars" data-home-sectors></div>
        </article>
        <article class="rrn-home-panel">
          <div class="rrn-home-panel-head"><div><h3>Atividade recente</h3><small>Últimas movimentações registradas</small></div></div>
          <div class="rrn-activity-list" data-home-activity></div>
        </article>
      </section>
      <section class="rrn-home-grid rrn-secondary-grid">
        <article class="rrn-home-panel">
          <div class="rrn-home-panel-head"><div><h3>Distribuição por tipo</h3><small>Composição atual do inventário</small></div></div>
          <div class="rrn-type-list" data-home-types></div>
        </article>
        <article class="rrn-home-panel">
          <div class="rrn-home-panel-head"><div><h3>Atenção operacional</h3><small>Itens que merecem acompanhamento</small></div></div>
          <div class="rrn-alert-grid">
            <div class="rrn-alert-column"><h4><span data-rrn-icon="wrench"></span>Manutenção</h4><div class="rrn-alert-list" data-home-maintenance></div></div>
            <div class="rrn-alert-column"><h4><span data-rrn-icon="calendar"></span>Garantias</h4><div class="rrn-alert-list" data-home-warranty></div></div>
          </div>
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
    window.RRN_ICONS?.decorateStatic?.(home);
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
      <button type="button" class="rrn-app-tab" data-app-tab="dashboard" data-rrn-icon="dashboard" role="tab">Visão Geral</button>
      <button type="button" class="rrn-app-tab" data-app-tab="inventory" data-rrn-icon="inventory" role="tab">Inventário</button>`;
    const search = document.getElementById('searchInput');
    nav.insertBefore(host, search || nav.firstChild);
    host.querySelectorAll('[data-app-tab]').forEach(button => button.addEventListener('click', () => setTab(button.dataset.appTab)));
    window.RRN_ICONS?.decorateStatic?.(host);
    return host;
  }

  function applyRole() {
    const role = sessionInfo().role;
    const canOperate = role === 'admin' || role === 'operador' || !role;
    document.querySelectorAll('#rrnDashboardHome .operador-only').forEach(el => { el.style.display = canOperate ? '' : 'none'; });
  }

  function renderHealth(current) {
    const host = ensureHome().querySelector('[data-home-health]');
    if (!host) return;
    const values = [
      ['check', 'Operando', current.operating, 'Disponíveis para uso'],
      ['box', 'Estoque', current.stock, 'Sem usuário em operação'],
      ['transfer', 'Emprestados', current.borrowed, 'Em uso temporário'],
      ['user', 'Sem responsável', current.unassigned, 'Cadastro sem usuário']
    ];
    host.innerHTML = values.map(([icon, label, value, detail]) => `
      <article class="rrn-health-item">
        <span class="rrn-health-icon" data-rrn-icon="${icon}"></span>
        <div class="rrn-health-copy"><strong>${value} ${esc(label)}</strong><small>${esc(detail)}</small></div>
      </article>`).join('');
    window.RRN_ICONS?.decorateStatic?.(host);
  }

  function renderSectors() {
    const host = ensureHome().querySelector('[data-home-sectors]');
    const buckets = sectorBuckets();
    if (!host) return;
    if (!buckets.length) {
      host.innerHTML = '<div class="rrn-home-empty">Crie o primeiro setor para iniciar a distribuição do inventário.</div>';
      return;
    }
    const max = Math.max(...buckets.map(item => item.count), 1);
    host.innerHTML = buckets.map(item => `
      <div class="rrn-sector-bar">
        <span class="rrn-sector-bar-label" title="${esc(item.name)}">${esc(item.name)}${item.maintenance ? `<small class="rrn-sector-maint">${item.maintenance} em manutenção</small>` : ''}</span>
        <div class="rrn-sector-track"><div class="rrn-sector-fill" style="width:${item.count ? Math.max(6, (item.count / max) * 100) : 0}%"></div></div>
        <span class="rrn-sector-bar-value">${item.count}</span>
      </div>`).join('');
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
    return event?.title || ({created:'Equipamento cadastrado', asset_created:'Equipamento cadastrado', moved:'Equipamento transferido', asset_moved:'Equipamento transferido', deleted:'Item movido para a lixeira', asset_deleted:'Equipamento movido para a lixeira', sector_deleted:'Setor movido para a lixeira', restored:'Item restaurado', maintenance_started:'Manutenção iniciada', maintenance_released:'Equipamento liberado'}[event?.eventType] || event?.eventType || 'Alteração no inventário');
  }

  function renderActivity() {
    const host = ensureHome().querySelector('[data-home-activity]');
    const recent = historyItems().slice().reverse().slice(0, 6);
    if (!recent.length) {
      host.innerHTML = '<div class="rrn-home-empty">As próximas alterações do inventário aparecerão aqui.</div>';
      return;
    }
    host.innerHTML = recent.map(event => {
      const date = parseDate(event?.timestamp || event?.createdAt || event?.created_at);
      const details = [event?.assetLabel || event?.entityId, event?.fromSector && event?.toSector ? `${event.fromSector} → ${event.toSector}` : (event?.toSector || event?.fromSector), date ? date.toLocaleString('pt-BR') : ''].filter(Boolean).join(' · ');
      return `<div class="rrn-activity"><span class="rrn-activity-dot"></span><div><strong>${esc(activityLabel(event))}</strong><small>${esc(details || 'Registro do inventário')}</small></div></div>`;
    }).join('');
  }

  function bindAssetButtons(host) {
    host.querySelectorAll('[data-home-open-asset]').forEach(button => {
      button.addEventListener('click', () => {
        const [sectorIndex, assetIndex] = button.dataset.homeOpenAsset.split(':').map(Number);
        setTab('inventory');
        setTimeout(() => window.showInfo?.(sectorIndex, assetIndex), 80);
      });
    });
    window.RRN_ICONS?.decorateStatic?.(host);
  }

  function renderMaintenance() {
    const host = ensureHome().querySelector('[data-home-maintenance]');
    if (!host) return;
    const items = maintenanceItems();
    if (!items.length) {
      host.innerHTML = '<div class="rrn-home-empty">Nenhum equipamento em manutenção.</div>';
      return;
    }
    host.innerHTML = items.map(asset => `
      <div class="rrn-alert-item">
        <div><strong>${esc(assetLabel(asset))}<span class="rrn-priority">${esc(asset.__priority)}</span></strong><small>${esc(asset.__sectorName)} · ${esc(asset?.tipoMaquina || asset?.tipo || 'Equipamento')}</small></div>
        <button type="button" class="rrn-alert-action" data-home-open-asset="${asset.__sectorIndex}:${asset.__assetIndex}" data-rrn-icon="info">Abrir</button>
      </div>`).join('');
    bindAssetButtons(host);
  }

  function renderWarranty() {
    const host = ensureHome().querySelector('[data-home-warranty]');
    if (!host) return;
    const items = warrantyItems();
    if (!items.length) {
      host.innerHTML = '<div class="rrn-home-empty">Nenhuma garantia vence nos próximos 60 dias.</div>';
      return;
    }
    host.innerHTML = items.map(asset => `
      <div class="rrn-alert-item">
        <div><strong>${esc(assetLabel(asset))}</strong><small>${esc(asset.__sectorName)} · <span class="rrn-warranty-days">${asset.__days === 0 ? 'vence hoje' : `${asset.__days} dia${asset.__days === 1 ? '' : 's'}`}</span></small></div>
        <button type="button" class="rrn-alert-action" data-home-open-asset="${asset.__sectorIndex}:${asset.__assetIndex}" data-rrn-icon="info">Abrir</button>
      </div>`).join('');
    bindAssetButtons(host);
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
    renderHealth(current);
    renderSectors();
    renderTypes();
    renderActivity();
    renderMaintenance();
    renderWarranty();
    applyRole();
    window.RRN_ICONS?.decorateStatic?.(home);
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
    ensureStage2Style();
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