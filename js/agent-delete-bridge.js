(() => {
  'use strict';
  if (window.__RRN_AGENT_DELETE_BRIDGE__) return;
  window.__RRN_AGENT_DELETE_BRIDGE__ = true;

  const wrapped = new Set();

  function db() {
    const cfg = window.RRN_SUPABASE || {};
    if (window.RRN_SUPABASE_CLIENT) return window.RRN_SUPABASE_CLIENT;
    if (!window.supabase?.createClient || !cfg.url || !cfg.anonKey) return null;
    window.RRN_SUPABASE_CLIENT = window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
    });
    return window.RRN_SUPABASE_CLIENT;
  }

  function sectors() {
    try { if (typeof setores !== 'undefined' && Array.isArray(setores)) return setores; } catch {}
    try {
      const parsed = JSON.parse(localStorage.getItem('setores') || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  function stock() {
    try {
      const parsed = JSON.parse(localStorage.getItem('rrn_stock_assets') || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  function deviceId(asset) { return String(asset?.agentDeviceId || '').trim(); }

  function stillPresent(id) {
    if (!id) return false;
    const inSectors = sectors().some(sector => (Array.isArray(sector?.maquinas) ? sector.maquinas : [])
      .some(asset => deviceId(asset) === id));
    if (inSectors) return true;
    return stock().some(asset => deviceId(asset) === id);
  }

  async function removeAgent(id) {
    if (!id || stillPresent(id)) return;
    const client = db();
    if (!client) return;
    try {
      const { error } = await client.rpc('delete_agent_device_inventory', { p_device_id:id });
      if (error) throw error;
      window.dispatchEvent(new CustomEvent('rrn:agent-removed', { detail:{ deviceId:id } }));
      console.info('RRN Agent removido junto com a máquina:', id);
    } catch (error) {
      console.warn('Não foi possível remover o RRN Agent vinculado:', error?.message || error);
    }
  }

  function afterDelete(ids) {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return;
    setTimeout(() => unique.forEach(id => removeAgent(id)), 250);
  }

  function wrapRemoveMachine() {
    if (wrapped.has('removeMaquina') || typeof window.removeMaquina !== 'function') return false;
    const original = window.removeMaquina;
    window.removeMaquina = function(...args) {
      const sectorIndex = Number(args[0]);
      const assetIndex = Number(args[1]);
      const before = sectors()[sectorIndex]?.maquinas?.[assetIndex];
      const id = deviceId(before);
      const result = original.apply(this, args);
      afterDelete([id]);
      return result;
    };
    wrapped.add('removeMaquina');
    return true;
  }

  function wrapRemoveSector() {
    if (wrapped.has('removeSetor') || typeof window.removeSetor !== 'function') return false;
    const original = window.removeSetor;
    window.removeSetor = function(...args) {
      const sectorIndex = Number(args[0]);
      const ids = (sectors()[sectorIndex]?.maquinas || []).map(deviceId).filter(Boolean);
      const result = original.apply(this, args);
      afterDelete(ids);
      return result;
    };
    wrapped.add('removeSetor');
    return true;
  }

  function wrapDeleteAll() {
    if (wrapped.has('excluirTodosSetores') || typeof window.excluirTodosSetores !== 'function') return false;
    const original = window.excluirTodosSetores;
    window.excluirTodosSetores = function(...args) {
      const ids = sectors().flatMap(sector => (sector?.maquinas || []).map(deviceId)).filter(Boolean);
      const result = original.apply(this, args);
      afterDelete(ids);
      return result;
    };
    wrapped.add('excluirTodosSetores');
    return true;
  }

  function normalizeCountry(value) {
    const text = String(value || '').trim();
    return /^brazil$/i.test(text) ? 'Brasil' : text;
  }

  function locationText(location) {
    if (!location || typeof location !== 'object') return '';
    return [location.city, location.region, normalizeCountry(location.country)].filter(Boolean).join(', ');
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR', { dateStyle:'short', timeStyle:'short' });
  }

  function renderLocation(machine) {
    const host = document.querySelector('#modalText .rrn-machine-detail-card');
    if (!host) return;
    host.querySelector('[data-rrn-agent-location]')?.remove();

    const location = machine?.ultimaLocalizacao && typeof machine.ultimaLocalizacao === 'object'
      ? machine.ultimaLocalizacao
      : null;
    const hasAgent = Boolean(deviceId(machine));
    if (!hasAgent && !location) return;

    const text = locationText(location) || String(machine?.localizacao || '').trim();
    const lat = Number(location?.latitude);
    const lon = Number(location?.longitude);
    const coords = Number.isFinite(lat) && Number.isFinite(lon) ? `${lat.toFixed(6)}, ${lon.toFixed(6)}` : '';
    const captured = location?.captured_at || location?.capturadoEm || machine?.agentLastSeenAt || machine?.atualizadoEm;
    const source = String(location?.source || '').toLowerCase();

    const card = document.createElement('div');
    card.dataset.rrnAgentLocation = '1';
    card.style.gridColumn = '1 / -1';
    card.style.marginTop = '6px';
    card.style.padding = '10px 12px';
    card.style.border = '1px solid rgba(47,125,120,.22)';
    card.style.borderRadius = '10px';
    card.style.background = 'rgba(47,125,120,.08)';

    const title = document.createElement('strong');
    title.textContent = 'Localização do RRN Agent';
    title.style.display = 'block';
    title.style.color = 'var(--rrn-secondary,#2F7D78)';
    title.style.marginBottom = '5px';
    card.appendChild(title);

    const rows = [
      ['Última localização', text || 'Ainda não recebida'],
      ['Precisão', source === 'ip' ? 'Aproximada por IP público' : (source || 'Não informada')],
      ['Coordenadas', coords],
      ['Atualizada em', captured ? formatDate(captured) : '—']
    ].filter(([, value]) => value);

    rows.forEach(([label, value]) => {
      const row = document.createElement('div');
      row.className = 'rrn-info-row';
      const strong = document.createElement('strong');
      strong.textContent = `${label}:`;
      const span = document.createElement('span');
      span.textContent = ` ${value}`;
      row.append(strong, span);
      card.appendChild(row);
    });

    host.appendChild(card);
  }

  async function refreshLocation(sectorIndex, assetIndex) {
    const machine = sectors()[sectorIndex]?.maquinas?.[assetIndex];
    const id = deviceId(machine);
    if (!machine) return;
    renderLocation(machine);
    if (!id) return;

    const client = db();
    if (!client) return;
    try {
      const { data, error } = await client.from('agent_devices')
        .select('location_source,location_city,location_region,location_country,latitude,longitude,last_location_at,last_seen_at')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return;

      const location = {
        source: data.location_source || '',
        city: data.location_city || '',
        region: data.location_region || '',
        country: data.location_country || '',
        latitude: data.latitude,
        longitude: data.longitude,
        captured_at: data.last_location_at || data.last_seen_at || null
      };
      machine.ultimaLocalizacao = location;
      const text = locationText(location);
      if (text) machine.localizacao = text;
      machine.agentLastSeenAt = data.last_seen_at || machine.agentLastSeenAt;
      renderLocation(machine);
    } catch (error) {
      console.warn('RRN Agent localização:', error?.message || error);
    }
  }

  function wrapShowInfo() {
    if (wrapped.has('showInfo') || typeof window.showInfo !== 'function') return false;
    const original = window.showInfo;
    window.showInfo = function(...args) {
      const result = original.apply(this, args);
      const sectorIndex = Number(args[0]);
      const assetIndex = Number(args[1]);
      setTimeout(() => refreshLocation(sectorIndex, assetIndex), 0);
      return result;
    };
    wrapped.add('showInfo');
    return true;
  }

  function install() {
    wrapRemoveMachine();
    wrapRemoveSector();
    wrapDeleteAll();
    wrapShowInfo();
  }

  install();
  window.addEventListener('load', install);
  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    install();
    if (attempts > 80 || (wrapped.has('removeMaquina') && wrapped.has('removeSetor') && wrapped.has('showInfo'))) clearInterval(timer);
  }, 125);
})();
