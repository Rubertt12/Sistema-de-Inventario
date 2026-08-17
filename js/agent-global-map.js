(() => {
  'use strict';
  if (window.__RRN_AGENT_GLOBAL_MAP__) return;
  window.__RRN_AGENT_GLOBAL_MAP__ = true;

  const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  const allowedRoles = new Set(['admin', 'operador', 'monitoramento']);
  const state = {
    rows: [],
    loading: false,
    platformAdmin: false,
    status: 'all',
    tenant: 'all',
    map: null,
    markerLayer: null,
    markerByKey: new Map(),
    leafletPromise: null,
    initialized: false
  };

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[ch]));

  function client() {
    const cfg = window.RRN_SUPABASE || {};
    if (window.RRN_SUPABASE_CLIENT) return window.RRN_SUPABASE_CLIENT;
    if (!window.supabase?.createClient || !cfg.url || !cfg.anonKey) return null;
    window.RRN_SUPABASE_CLIENT = window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
    });
    return window.RRN_SUPABASE_CLIENT;
  }

  function sessionRole() {
    return String(window.RRN_SESSION?.role || '').toLowerCase();
  }

  function canView() {
    return state.platformAdmin || allowedRoles.has(sessionRole());
  }

  function validCoordinate(value, min, max) {
    const number = Number(value);
    return Number.isFinite(number) && number >= min && number <= max ? number : null;
  }

  function rowHasCoordinates(row) {
    return validCoordinate(row.latitude, -90, 90) != null && validCoordinate(row.longitude, -180, 180) != null;
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR', { dateStyle:'short', timeStyle:'short' });
  }

  function placeLabel(row) {
    return [row.city, row.region, row.country].filter(Boolean).join(' · ') || (rowHasCoordinates(row) ? 'Localização aproximada' : 'Localização indisponível');
  }

  function ensureLeaflet() {
    if (!document.querySelector('link[data-rrn-leaflet]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = LEAFLET_CSS;
      link.dataset.rrnLeaflet = '1';
      document.head.appendChild(link);
    }
    if (window.L) return Promise.resolve(window.L);
    if (state.leafletPromise) return state.leafletPromise;
    state.leafletPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-rrn-leaflet]');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.L), { once:true });
        existing.addEventListener('error', reject, { once:true });
        return;
      }
      const script = document.createElement('script');
      script.src = LEAFLET_JS;
      script.async = true;
      script.dataset.rrnLeaflet = '1';
      script.onload = () => resolve(window.L);
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return state.leafletPromise;
  }

  function ensureView() {
    let view = document.getElementById('rrnGlobalMapView');
    if (view) return view;
    view = document.createElement('section');
    view.id = 'rrnGlobalMapView';
    view.className = 'rrn-global-map-view';
    view.innerHTML = `
      <section class="rrn-map-hero">
        <div>
          <span class="rrn-map-eyebrow">Presença do RRN Manager</span>
          <h2>Mapa de instalações</h2>
          <p>Veja onde os Agentes RRN estão instalados. Os pontos são agrupados e arredondados para evitar exibir a posição exata de uma máquina individual.</p>
          <span class="rrn-map-scope" data-map-scope>Workspace atual</span>
        </div>
        <button type="button" class="rrn-map-refresh" data-map-refresh>Atualizar mapa</button>
      </section>

      <section class="rrn-map-kpis" aria-label="Indicadores do mapa">
        <article class="rrn-map-kpi"><span>Pontos no mapa</span><strong data-map-kpi="points">0</strong><small>Localidades agrupadas</small></article>
        <article class="rrn-map-kpi"><span>Agentes vinculados</span><strong data-map-kpi="agents">0</strong><small>Instalações registradas</small></article>
        <article class="rrn-map-kpi"><span>Países</span><strong data-map-kpi="countries">0</strong><small>Com localização identificada</small></article>
        <article class="rrn-map-kpi"><span>Atualizados ≤ 14h</span><strong data-map-kpi="online">0</strong><small>Comunicação recente</small></article>
        <article class="rrn-map-kpi"><span>Sem localização</span><strong data-map-kpi="unlocated">0</strong><small>Agentes sem coordenadas</small></article>
      </section>

      <section class="rrn-map-panel" data-map-panel>
        <div class="rrn-map-toolbar">
          <div class="rrn-map-filters">
            <button type="button" class="rrn-map-filter is-active" data-map-status="all">Todos</button>
            <button type="button" class="rrn-map-filter" data-map-status="online">Atualizados</button>
            <button type="button" class="rrn-map-filter" data-map-status="attention">Atenção</button>
            <button type="button" class="rrn-map-filter" data-map-status="offline">Sem comunicação</button>
            <select class="rrn-map-select" data-map-tenant hidden aria-label="Filtrar empresa"></select>
          </div>
          <div class="rrn-map-legend" aria-label="Legenda">
            <span><i></i>Atualizado</span><span class="warn"><i></i>Atenção</span><span class="off"><i></i>Sem comunicação</span>
          </div>
        </div>
        <div class="rrn-map-canvas-wrap">
          <div id="rrnGlobalMapCanvas" class="rrn-map-canvas" aria-label="Mapa mundial das instalações do RRN Manager"></div>
          <div class="rrn-map-loading">Carregando instalações…</div>
          <div class="rrn-map-empty" data-map-empty>Nenhum agente com localização disponível para este filtro.</div>
        </div>
        <div class="rrn-map-list">
          <div class="rrn-map-list-head"><h3>Localidades</h3><small data-map-list-count>0 localidades</small></div>
          <div class="rrn-map-location-list" data-map-list></div>
        </div>
      </section>`;

    const anchor = document.querySelector('.dashboard-actions') || document.querySelector('main');
    if (anchor?.parentNode) anchor.parentNode.insertBefore(view, anchor);
    else document.body.appendChild(view);

    view.querySelector('[data-map-refresh]')?.addEventListener('click', refresh);
    view.querySelectorAll('[data-map-status]').forEach(button => button.addEventListener('click', () => {
      state.status = button.dataset.mapStatus || 'all';
      view.querySelectorAll('[data-map-status]').forEach(item => item.classList.toggle('is-active', item === button));
      updateMapAndList();
    }));
    view.querySelector('[data-map-tenant]')?.addEventListener('change', event => {
      state.tenant = event.target.value || 'all';
      updateMapAndList();
    });
    return view;
  }

  function ensureTab() {
    if (!canView()) return null;
    const tabs = document.querySelector('.rrn-app-tabs');
    if (!tabs) return null;
    let button = tabs.querySelector('[data-app-tab="map"]');
    if (button) return button;
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'rrn-app-tab';
    button.dataset.appTab = 'map';
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', 'false');
    button.textContent = 'Mapa';
    button.addEventListener('click', openTab);
    tabs.appendChild(button);
    return button;
  }

  function closeMode() {
    if (!document.body.classList.contains('rrn-tab-map')) return;
    document.body.classList.remove('rrn-tab-map');
    const tab = document.querySelector('[data-app-tab="map"]');
    tab?.classList.remove('is-active');
    tab?.setAttribute('aria-selected', 'false');
  }

  function wireOtherTabs() {
    document.querySelectorAll('[data-app-tab]:not([data-app-tab="map"])').forEach(button => {
      if (button.dataset.rrnMapCloseBound) return;
      button.dataset.rrnMapCloseBound = '1';
      button.addEventListener('click', closeMode, true);
    });
  }

  async function openTab() {
    if (!canView()) return;
    ensureView();
    ensureTab();
    document.body.classList.remove('rrn-tab-dashboard', 'rrn-tab-inventory', 'rrn-tab-stock', 'rrn-tab-agents');
    document.body.classList.add('rrn-tab-map');
    document.querySelectorAll('[data-app-tab]').forEach(button => {
      const active = button.dataset.appTab === 'map';
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
    history.replaceState(null, '', `${location.pathname}${location.search}#map`);
    await refresh();
    setTimeout(() => state.map?.invalidateSize(), 80);
  }

  function statusCounts(row) {
    return {
      all: Number(row.agents_count || 0),
      online: Number(row.online_count || 0),
      attention: Number(row.attention_count || 0),
      offline: Number(row.offline_count || 0)
    };
  }

  function selectedCount(row) {
    return statusCounts(row)[state.status] || 0;
  }

  function rowVisualStatus(row) {
    if (state.status === 'online') return 'ok';
    if (state.status === 'attention') return 'warn';
    if (state.status === 'offline') return 'off';
    const counts = statusCounts(row);
    if (counts.offline > 0 && counts.online === 0 && counts.attention === 0) return 'off';
    if (counts.attention > 0 && counts.online === 0 && counts.offline === 0) return 'warn';
    if (counts.offline > 0 || counts.attention > 0) return 'mixed';
    return 'ok';
  }

  function filteredRows() {
    return state.rows.filter(row => {
      if (state.tenant !== 'all' && String(row.tenant_id || '') !== state.tenant) return false;
      return selectedCount(row) > 0;
    });
  }

  function normalizeRpcRow(row) {
    return {
      tenant_id: row.tenant_id || null,
      tenant_name: row.tenant_name || window.RRN_SESSION?.tenantName || 'Workspace',
      city: row.city || '',
      region: row.region || '',
      country: row.country || '',
      latitude: row.latitude == null ? null : Number(row.latitude),
      longitude: row.longitude == null ? null : Number(row.longitude),
      agents_count: Number(row.agents_count || 0),
      online_count: Number(row.online_count || 0),
      attention_count: Number(row.attention_count || 0),
      offline_count: Number(row.offline_count || 0),
      precise_count: Number(row.precise_count || 0),
      last_seen_at: row.last_seen_at || null
    };
  }

  function deviceStatus(device) {
    if (String(device.status || 'active') !== 'active') return 'offline';
    const seen = new Date(device.last_seen_at || 0).getTime();
    if (!Number.isFinite(seen) || seen <= 0) return 'offline';
    const hours = Math.max(0, (Date.now() - seen) / 3600000);
    if (hours <= 14) return 'online';
    if (hours <= 36) return 'attention';
    return 'offline';
  }

  function aggregateDevices(devices) {
    const tenantId = window.RRN_SESSION?.tenantId || window.RRN_SESSION?.tenant_id || '';
    const tenantName = window.RRN_SESSION?.tenantName || window.RRN_SESSION?.tenant_name || 'Workspace atual';
    const groups = new Map();
    (Array.isArray(devices) ? devices : []).forEach(device => {
      const lat = validCoordinate(device.latitude, -90, 90);
      const lng = validCoordinate(device.longitude, -180, 180);
      const roundedLat = lat == null ? null : Math.round(lat * 100) / 100;
      const roundedLng = lng == null ? null : Math.round(lng * 100) / 100;
      const city = String(device.location_city || '').trim();
      const region = String(device.location_region || '').trim();
      const country = String(device.location_country || '').trim();
      const key = `${tenantId}|${roundedLat ?? 'x'}|${roundedLng ?? 'x'}|${city}|${region}|${country}`;
      if (!groups.has(key)) groups.set(key, {
        tenant_id: tenantId,
        tenant_name: tenantName,
        city, region, country,
        latitude: roundedLat,
        longitude: roundedLng,
        agents_count: 0,
        online_count: 0,
        attention_count: 0,
        offline_count: 0,
        precise_count: 0,
        last_seen_at: null
      });
      const row = groups.get(key);
      row.agents_count += 1;
      row[`${deviceStatus(device)}_count`] += 1;
      if (['gps','wifi','cellular','windows','windows_default'].includes(String(device.location_source || '').toLowerCase())) row.precise_count += 1;
      if (!row.last_seen_at || new Date(device.last_seen_at || 0) > new Date(row.last_seen_at || 0)) row.last_seen_at = device.last_seen_at || row.last_seen_at;
    });
    return [...groups.values()];
  }

  async function loadRows() {
    const db = client();
    if (!db) throw new Error('Backend indisponível.');
    if (state.platformAdmin) {
      const { data, error } = await db.rpc('platform_agent_installation_map');
      if (!error) return (Array.isArray(data) ? data : []).map(normalizeRpcRow);
      console.warn('RRN mapa global: fallback para workspace atual.', error);
    }
    const { data, error } = await db.from('agent_devices')
      .select('tenant_id,last_seen_at,status,location_source,location_city,location_region,location_country,latitude,longitude')
      .order('last_seen_at', { ascending:false })
      .limit(1000);
    if (error) throw error;
    return aggregateDevices(data);
  }

  function summary() {
    const countries = new Set();
    let agents = 0;
    let online = 0;
    let unlocated = 0;
    let points = 0;
    state.rows.forEach(row => {
      agents += Number(row.agents_count || 0);
      online += Number(row.online_count || 0);
      if (row.country) countries.add(String(row.country).toLowerCase());
      if (rowHasCoordinates(row)) points += 1;
      else unlocated += Number(row.agents_count || 0);
    });
    return { points, agents, countries:countries.size, online, unlocated };
  }

  function renderHeader() {
    const view = ensureView();
    const values = summary();
    Object.entries(values).forEach(([key, value]) => {
      const node = view.querySelector(`[data-map-kpi="${key}"]`);
      if (node) node.textContent = String(value);
    });
    const scope = view.querySelector('[data-map-scope]');
    if (scope) scope.textContent = state.platformAdmin ? 'Visão global da plataforma' : (window.RRN_SESSION?.tenantName || 'Workspace atual');
    const refreshButton = view.querySelector('[data-map-refresh]');
    if (refreshButton) refreshButton.disabled = state.loading;
    view.querySelector('[data-map-panel]')?.classList.toggle('is-loading', state.loading);
  }

  function renderTenantFilter() {
    const select = ensureView().querySelector('[data-map-tenant]');
    if (!select) return;
    const tenants = [...new Map(state.rows.map(row => [String(row.tenant_id || ''), row.tenant_name || 'Workspace'])).entries()]
      .filter(([id]) => id)
      .sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
    if (!state.platformAdmin || tenants.length <= 1) {
      select.hidden = true;
      state.tenant = 'all';
      return;
    }
    const previous = tenants.some(([id]) => id === state.tenant) ? state.tenant : 'all';
    select.innerHTML = `<option value="all">Todas as empresas</option>${tenants.map(([id, name]) => `<option value="${esc(id)}">${esc(name)}</option>`).join('')}`;
    select.value = previous;
    state.tenant = previous;
    select.hidden = false;
  }

  function markerKey(row) {
    return `${row.tenant_id || ''}|${row.latitude}|${row.longitude}|${row.city}|${row.region}|${row.country}`;
  }

  function popupHtml(row, count) {
    const counts = statusCounts(row);
    return `<div class="rrn-map-popup">
      <strong>${esc(row.tenant_name || 'RRN Manager')}</strong>
      <small>${esc(placeLabel(row))}</small>
      <div class="rrn-map-popup-stats">
        <span><b>${count}</b>${state.status === 'all' ? 'agentes' : 'no filtro'}</span>
        <span><b>${counts.online}</b>atualizados</span>
        <span><b>${counts.offline}</b>sem comunicação</span>
      </div>
      <small>Última comunicação: ${esc(formatDate(row.last_seen_at))}</small>
      <small>${row.precise_count ? `${row.precise_count} agente(s) já forneceram localização mais precisa.` : 'Ponto exibido de forma agrupada/aproximada.'}</small>
    </div>`;
  }

  async function ensureMap() {
    const L = await ensureLeaflet();
    const element = document.getElementById('rrnGlobalMapCanvas');
    if (!element) return null;
    if (!state.map) {
      state.map = L.map(element, { zoomControl:true, worldCopyJump:true, minZoom:2 }).setView([18, 0], 2);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom:18,
        attribution:'&copy; OpenStreetMap contributors'
      }).addTo(state.map);
      state.markerLayer = L.layerGroup().addTo(state.map);
    }
    return L;
  }

  async function renderMap(rows) {
    const empty = ensureView().querySelector('[data-map-empty]');
    try {
      const L = await ensureMap();
      if (!L || !state.map || !state.markerLayer) return;
      state.markerLayer.clearLayers();
      state.markerByKey.clear();
      const bounds = [];
      rows.filter(rowHasCoordinates).forEach(row => {
        const count = selectedCount(row);
        if (count <= 0) return;
        const lat = Number(row.latitude);
        const lng = Number(row.longitude);
        const size = Math.round(32 + Math.min(28, Math.log2(count + 1) * 6));
        const visual = rowVisualStatus(row);
        const icon = L.divIcon({
          className:'rrn-map-bubble-wrap',
          html:`<div class="rrn-map-bubble ${visual}" style="--rrn-bubble-size:${size}px">${count}</div>`,
          iconSize:[size, size],
          iconAnchor:[size / 2, size / 2]
        });
        const marker = L.marker([lat, lng], { icon }).bindPopup(popupHtml(row, count));
        marker.addTo(state.markerLayer);
        state.markerByKey.set(markerKey(row), marker);
        bounds.push([lat, lng]);
      });
      empty?.classList.toggle('show', bounds.length === 0);
      if (bounds.length === 1) state.map.setView(bounds[0], state.platformAdmin ? 5 : 9);
      else if (bounds.length > 1) state.map.fitBounds(bounds, { padding:[35,35], maxZoom:state.platformAdmin ? 6 : 10 });
      else state.map.setView([18, 0], 2);
      setTimeout(() => state.map?.invalidateSize(), 60);
    } catch (error) {
      console.warn('RRN mapa de instalações:', error);
      if (empty) {
        empty.textContent = 'Não foi possível carregar o mapa agora. A lista de localidades continua disponível abaixo.';
        empty.classList.add('show');
      }
    }
  }

  function renderList(rows) {
    const view = ensureView();
    const list = view.querySelector('[data-map-list]');
    const countLabel = view.querySelector('[data-map-list-count]');
    if (!list) return;
    const ordered = rows.slice().sort((a, b) => selectedCount(b) - selectedCount(a) || new Date(b.last_seen_at || 0) - new Date(a.last_seen_at || 0));
    if (countLabel) countLabel.textContent = `${ordered.length} localidade${ordered.length === 1 ? '' : 's'}`;
    if (!ordered.length) {
      list.innerHTML = '<div class="rrn-map-empty show" style="position:static;transform:none;max-width:none">Nenhuma localidade corresponde aos filtros atuais.</div>';
      return;
    }
    list.innerHTML = ordered.slice(0, 40).map((row, index) => {
      const counts = statusCounts(row);
      const hasPoint = rowHasCoordinates(row);
      return `<div class="rrn-map-location-row">
        <div><strong>${esc(row.tenant_name || 'RRN Manager')}</strong><small>${esc(placeLabel(row))}</small></div>
        <div><strong>${selectedCount(row)} agente${selectedCount(row) === 1 ? '' : 's'}</strong><small>Última comunicação ${esc(formatDate(row.last_seen_at))}</small></div>
        <div class="rrn-map-location-metric"><b>${counts.online}</b><span>Atualizados</span></div>
        <div class="rrn-map-location-metric"><b>${counts.attention}</b><span>Atenção</span></div>
        <div class="rrn-map-location-metric"><b>${counts.offline}</b><span>Offline</span></div>
        <button type="button" data-map-focus="${index}" ${hasPoint ? '' : 'disabled'}>${hasPoint ? 'Ver no mapa' : 'Sem ponto'}</button>
      </div>`;
    }).join('');
    list.querySelectorAll('[data-map-focus]').forEach(button => button.addEventListener('click', () => {
      const row = ordered[Number(button.dataset.mapFocus)];
      focusRow(row);
    }));
  }

  function focusRow(row) {
    if (!rowHasCoordinates(row) || !state.map) return;
    state.map.setView([Number(row.latitude), Number(row.longitude)], state.platformAdmin ? 7 : 11, { animate:true });
    const marker = state.markerByKey.get(markerKey(row));
    setTimeout(() => marker?.openPopup(), 250);
    document.getElementById('rrnGlobalMapCanvas')?.scrollIntoView({ behavior:'smooth', block:'center' });
  }

  function updateMapAndList() {
    const rows = filteredRows();
    renderList(rows);
    renderMap(rows);
  }

  async function refresh() {
    if (state.loading) return;
    state.loading = true;
    renderHeader();
    try {
      state.rows = await loadRows();
      renderTenantFilter();
      renderHeader();
      await updateMapAndList();
    } catch (error) {
      console.error('RRN mapa: falha ao carregar instalações.', error);
      state.rows = [];
      renderHeader();
      renderTenantFilter();
      updateMapAndList();
      const empty = ensureView().querySelector('[data-map-empty]');
      if (empty) {
        empty.textContent = error?.message || 'Não foi possível carregar as instalações.';
        empty.classList.add('show');
      }
    } finally {
      state.loading = false;
      renderHeader();
    }
  }

  async function refreshPermissions() {
    const db = client();
    if (!db) return;
    try {
      const { data, error } = await db.rpc('is_platform_admin');
      state.platformAdmin = !error && data === true;
    } catch {
      state.platformAdmin = false;
    }
    if (!canView()) {
      document.querySelector('[data-app-tab="map"]')?.remove();
      closeMode();
      return;
    }
    ensureView();
    ensureTab();
    wireOtherTabs();
    if (location.hash.toLowerCase() === '#map') await openTab();
  }

  function boot() {
    ensureView();
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (canView()) ensureTab();
      wireOtherTabs();
      if (window.RRN_SESSION || tries > 100) {
        clearInterval(timer);
        refreshPermissions();
      }
    }, 100);
    window.addEventListener('rrn:session-ready', refreshPermissions);
    window.addEventListener('pageshow', () => {
      if (document.body.classList.contains('rrn-tab-map')) setTimeout(() => state.map?.invalidateSize(), 80);
    });
  }

  window.RRN_AGENT_GLOBAL_MAP = Object.freeze({ open:openTab, refresh });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
