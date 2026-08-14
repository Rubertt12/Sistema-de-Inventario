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

  function install() {
    wrapRemoveMachine();
    wrapRemoveSector();
    wrapDeleteAll();
  }

  install();
  window.addEventListener('load', install);
  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    install();
    if (attempts > 80 || (wrapped.has('removeMaquina') && wrapped.has('removeSetor'))) clearInterval(timer);
  }, 125);
})();
