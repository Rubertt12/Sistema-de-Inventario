(() => {
  'use strict';
  if (window.__RRN_MACHINE_LOCATION_MAP__) return;
  window.__RRN_MACHINE_LOCATION_MAP__ = true;

  const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  let leafletPromise = null;
  let miniMap = null;
  let bigMap = null;
  let lastMachine = null;
  let historyCache = [];

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'
  }[ch]));

  function db() {
    const cfg = window.RRN_SUPABASE || {};
    if (window.RRN_SUPABASE_CLIENT) return window.RRN_SUPABASE_CLIENT;
    if (!window.supabase?.createClient || !cfg.url || !cfg.anonKey) return null;
    window.RRN_SUPABASE_CLIENT = window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    return window.RRN_SUPABASE_CLIENT;
  }

  function injectStyles() {
    if (!document.querySelector('link[data-rrn-leaflet]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = LEAFLET_CSS;
      link.dataset.rrnLeaflet = '1';
      document.head.appendChild(link);
    }
    if (document.getElementById('rrn-machine-location-map-style')) return;
    const style = document.createElement('style');
    style.id = 'rrn-machine-location-map-style';
    style.textContent = `
      .rrn-agent-location-card{grid-column:1/-1;margin-top:8px;padding:12px;border:1px solid rgba(41,89,145,.18);border-radius:12px;background:rgba(255,255,255,.58)}
      .rrn-agent-location-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:9px}
      .rrn-agent-location-head h3{margin:0;color:#295991;font-size:.86rem}.rrn-agent-location-head p{margin:3px 0 0;color:#687587;font-size:.68rem}
      .rrn-agent-location-meta{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-bottom:9px}
      .rrn-agent-location-meta div{padding:8px;border-radius:9px;background:rgba(41,89,145,.06)}.rrn-agent-location-meta span{display:block;color:#737b89;font-size:.61rem;font-weight:700}.rrn-agent-location-meta strong{display:block;margin-top:2px;color:#35445a;font-size:.7rem;overflow-wrap:anywhere}
      .rrn-agent-mini-map{height:220px;border-radius:11px;overflow:hidden;border:1px solid rgba(41,89,145,.16);background:#eef2f3}
      .rrn-agent-location-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:9px}.rrn-agent-location-actions button,.rrn-agent-location-actions a{display:inline-flex;align-items:center;justify-content:center;padding:7px 10px;border:1px solid rgba(41,89,145,.2);border-radius:9px;background:#fff;color:#295991;font-size:.68rem;font-weight:700;text-decoration:none;cursor:pointer}
      .rrn-agent-history{margin-top:10px}.rrn-agent-history summary{cursor:pointer;color:#295991;font-size:.7rem;font-weight:800}.rrn-agent-history-list{display:grid;gap:6px;margin-top:7px}.rrn-agent-history-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:7px 9px;border-left:3px solid rgba(41,89,145,.3);background:rgba(41,89,145,.045);border-radius:7px}.rrn-agent-history-row strong{font-size:.68rem;color:#35445a}.rrn-agent-history-row small{font-size:.6rem;color:#737b89;white-space:nowrap}
      .rrn-agent-map-modal{position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(12,22,30,.72)}.rrn-agent-map-modal.open{display:flex}.rrn-agent-map-dialog{width:min(980px,96vw);height:min(760px,92vh);display:grid;grid-template-rows:auto 1fr auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.3)}.rrn-agent-map-dialog-head{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:14px 16px;border-bottom:1px solid #e5eaee}.rrn-agent-map-dialog-head h2{margin:0;font-size:1rem;color:#24384d}.rrn-agent-map-close{border:0;background:transparent;font-size:1.4rem;cursor:pointer}.rrn-agent-big-map{min-height:420px}.rrn-agent-map-footer{padding:10px 14px;color:#687587;font-size:.67rem;border-top:1px solid #e5eaee}
      @media(max-width:650px){.rrn-agent-location-meta{grid-template-columns:1fr}.rrn-agent-mini-map{height:190px}.rrn-agent-map-dialog{width:100%;height:88vh}.rrn-agent-history-row{grid-template-columns:1fr}.rrn-agent-history-row small{white-space:normal}}
    `;
    document.head.appendChild(style);
  }

  function loadLeaflet() {
    injectStyles();
    if (window.L) return Promise.resolve(window.L);
    if (leafletPromise) return leafletPromise;
    leafletPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-rrn-leaflet]');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.L), { once: true });
        existing.addEventListener('error', reject, { once: true });
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
    return leafletPromise;
  }

  function currentMachine() {
    try {
      if (typeof maquinaAtivaSetor !== 'undefined' && typeof maquinaAtivaIndex !== 'undefined' && Array.isArray(setores)) {
        return setores?.[maquinaAtivaSetor]?.maquinas?.[maquinaAtivaIndex] || null;
      }
    } catch {}
    return null;
  }

  function locationOf(machine) {
    const loc = machine?.ultimaLocalizacao || {};
    const latitude = Number(loc.latitude ?? machine?.latitude);
    const longitude = Number(loc.longitude ?? machine?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return {
      latitude,
      longitude,
      city: loc.city || loc.cidade || '',
      region: loc.region || loc.estado || '',
      country: loc.country || loc.pais || '',
      source: String(loc.source || machine?.locationSource || 'ip').toLowerCase(),
      capturedAt: loc.captured_at || loc.capturedAt || machine?.agentLastSeenAt || machine?.atualizadoEm || null
    };
  }

  function formatPlace(loc) {
    return [loc?.city, loc?.region, loc?.country].filter(Boolean).join(', ') || 'Localização registrada';
  }

  function formatDate(value) {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  function googleUrl(lat, lng) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
  }

  function ensureBigModal() {
    let host = document.getElementById('rrnAgentMapModal');
    if (host) return host;
    host = document.createElement('div');
    host.id = 'rrnAgentMapModal';
    host.className = 'rrn-agent-map-modal';
    host.setAttribute('aria-hidden', 'true');
    host.innerHTML = `<div class="rrn-agent-map-dialog" role="dialog" aria-modal="true" aria-label="Mapa da máquina"><div class="rrn-agent-map-dialog-head"><h2 id="rrnAgentMapTitle">Localização da máquina</h2><button type="button" class="rrn-agent-map-close" aria-label="Fechar">×</button></div><div id="rrnAgentBigMap" class="rrn-agent-big-map"></div><div class="rrn-agent-map-footer">Localização aproximada quando obtida pelo IP público. O ponto pode representar a região do provedor e não a posição física exata do equipamento.</div></div>`;
    document.body.appendChild(host);
    const close = () => {
      host.classList.remove('open');
      host.setAttribute('aria-hidden', 'true');
      if (bigMap) { bigMap.remove(); bigMap = null; }
    };
    host.querySelector('.rrn-agent-map-close').addEventListener('click', close);
    host.addEventListener('click', e => { if (e.target === host) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && host.classList.contains('open')) close(); });
    return host;
  }

  function addTiles(L, map) {
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
  }

  async function renderMiniMap(loc, history) {
    try {
      const L = await loadLeaflet();
      const el = document.getElementById('rrnAgentMiniMap');
      if (!el || !document.body.contains(el)) return;
      if (miniMap) { miniMap.remove(); miniMap = null; }
      miniMap = L.map(el, { zoomControl: true, attributionControl: true }).setView([loc.latitude, loc.longitude], 12);
      addTiles(L, miniMap);
      L.marker([loc.latitude, loc.longitude]).addTo(miniMap).bindPopup(`${esc(formatPlace(loc))}<br>${esc(formatDate(loc.capturedAt))}`);
      const points = history.filter(p => Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude))).slice().reverse();
      if (points.length > 1) {
        const latlngs = points.map(p => [Number(p.latitude), Number(p.longitude)]);
        L.polyline(latlngs, { weight: 3, opacity: .6 }).addTo(miniMap);
      }
      setTimeout(() => miniMap?.invalidateSize(), 80);
    } catch (error) {
      console.warn('RRN mapa:', error);
      const el = document.getElementById('rrnAgentMiniMap');
      if (el) el.innerHTML = '<div style="padding:16px;font-size:.72rem;color:#687587">Não foi possível carregar o mapa agora.</div>';
    }
  }

  async function openBigMap(machine, loc, history) {
    const host = ensureBigModal();
    host.classList.add('open');
    host.setAttribute('aria-hidden', 'false');
    document.getElementById('rrnAgentMapTitle').textContent = `${machine?.hostname || machine?.nome || 'Máquina'} · ${formatPlace(loc)}`;
    try {
      const L = await loadLeaflet();
      if (bigMap) bigMap.remove();
      bigMap = L.map('rrnAgentBigMap').setView([loc.latitude, loc.longitude], 12);
      addTiles(L, bigMap);
      const points = history.filter(p => Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude))).slice().reverse();
      if (points.length) {
        const latlngs = points.map(p => [Number(p.latitude), Number(p.longitude)]);
        if (latlngs.length > 1) L.polyline(latlngs, { weight: 4, opacity: .7 }).addTo(bigMap);
        points.forEach((p, i) => {
          L.circleMarker([Number(p.latitude), Number(p.longitude)], { radius: i === points.length - 1 ? 7 : 4, weight: 2, fillOpacity: .8 })
            .addTo(bigMap)
            .bindPopup(`${esc([p.location_city,p.location_region,p.location_country].filter(Boolean).join(', ') || 'Localização')}<br>${esc(formatDate(p.occurred_at))}`);
        });
        if (latlngs.length > 1) bigMap.fitBounds(latlngs, { padding: [35, 35], maxZoom: 14 });
      }
      L.marker([loc.latitude, loc.longitude]).addTo(bigMap).bindPopup(`Última posição<br>${esc(formatDate(loc.capturedAt))}`).openPopup();
      setTimeout(() => bigMap?.invalidateSize(), 80);
    } catch (error) { console.warn('RRN mapa ampliado:', error); }
  }

  async function loadHistory(deviceId) {
    if (!deviceId) return [];
    const client = db();
    if (!client) return [];
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    try {
      const { data, error } = await client.from('agent_heartbeats')
        .select('occurred_at,location_source,location_city,location_region,location_country,latitude,longitude')
        .eq('device_id', deviceId)
        .gte('occurred_at', since)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .order('occurred_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.warn('RRN histórico de localização:', error);
      return [];
    }
  }

  function historyHtml(history) {
    if (!history.length) return '<div class="rrn-agent-history-row"><strong>Nenhum ponto histórico disponível.</strong><small>—</small></div>';
    return history.slice(0, 12).map(p => `<div class="rrn-agent-history-row"><strong>${esc([p.location_city,p.location_region,p.location_country].filter(Boolean).join(', ') || `${Number(p.latitude).toFixed(4)}, ${Number(p.longitude).toFixed(4)}`)}</strong><small>${esc(formatDate(p.occurred_at))}</small></div>`).join('');
  }

  async function enhance(machine) {
    const container = document.querySelector('#modalText .rrn-machine-detail-card');
    if (!container || !machine?.agentDeviceId) return;
    const loc = locationOf(machine);
    if (!loc) return;
    lastMachine = machine;
    historyCache = await loadHistory(machine.agentDeviceId);
    if (!document.body.contains(container)) return;

    container.querySelector('.rrn-agent-location-card')?.remove();
    const card = document.createElement('section');
    card.className = 'rrn-agent-location-card';
    card.innerHTML = `
      <div class="rrn-agent-location-head"><div><h3>Localização do RRN Agent</h3><p>${loc.source === 'ip' ? 'Localização aproximada por IP público' : 'Última localização coletada pelo agente'}</p></div></div>
      <div class="rrn-agent-location-meta">
        <div><span>Local</span><strong>${esc(formatPlace(loc))}</strong></div>
        <div><span>Coordenadas</span><strong>${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}</strong></div>
        <div><span>Última coleta</span><strong>${esc(formatDate(loc.capturedAt))}</strong></div>
      </div>
      <div id="rrnAgentMiniMap" class="rrn-agent-mini-map" aria-label="Mapa da última localização da máquina"></div>
      <div class="rrn-agent-location-actions">
        <button type="button" data-rrn-map-expand>Ver mapa maior</button>
        <a href="${googleUrl(loc.latitude, loc.longitude)}" target="_blank" rel="noopener noreferrer">Abrir no Google Maps</a>
      </div>
      <details class="rrn-agent-history"><summary>Histórico de localizações · últimos 30 dias</summary><div class="rrn-agent-history-list">${historyHtml(historyCache)}</div></details>`;
    container.appendChild(card);
    card.querySelector('[data-rrn-map-expand]')?.addEventListener('click', () => openBigMap(machine, loc, historyCache));
    renderMiniMap(loc, historyCache);
  }

  function install() {
    injectStyles();
    const original = window.showInfo;
    if (typeof original !== 'function' || original.__rrnLocationMapWrapped) return;
    const wrapped = function(...args) {
      const result = original.apply(this, args);
      const machine = currentMachine();
      Promise.resolve().then(() => enhance(machine));
      return result;
    };
    wrapped.__rrnLocationMapWrapped = true;
    window.showInfo = wrapped;
  }

  injectStyles();
  install();
  window.addEventListener('load', install, { once: true });
  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    install();
    if (attempts >= 40 || window.showInfo?.__rrnLocationMapWrapped) clearInterval(timer);
  }, 150);
})();
