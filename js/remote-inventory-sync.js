(() => {
  'use strict';
  if (window.__RRN_REMOTE_INVENTORY_SYNC__) return;
  window.__RRN_REMOTE_INVENTORY_SYNC__ = true;

  const cfg = window.RRN_SUPABASE || {};
  if (!window.supabase?.createClient || !cfg.url || !cfg.anonKey) return;

  const client = window.RRN_SUPABASE_CLIENT || window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  window.RRN_SUPABASE_CLIENT = client;

  const syncKeys = ['setores', 'chamados', 'asset_history', 'asset_trash'];
  const rawSetItem = Storage.prototype.setItem;
  const rawRemoveItem = Storage.prototype.removeItem;
  let channel = null;
  let tenantId = null;
  let lastRemoteUpdatedAt = null;
  let applyingRemote = false;

  function ensureSearchAssets() {
    if (!document.querySelector('link[data-rrn-search-center]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/style/search-center-v2.css';
      link.dataset.rrnSearchCenter = '1';
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[data-rrn-search-center]')) {
      const script = document.createElement('script');
      script.src = '/js/search-center-v2.js';
      script.async = false;
      script.dataset.rrnSearchCenter = '1';
      document.head.appendChild(script);
    }
  }

  function stateFromPayload(payload = {}) {
    return payload && typeof payload === 'object' ? payload : {};
  }

  function sameValue(key, value) {
    if (value === undefined) return true;
    const next = typeof value === 'string' ? value : JSON.stringify(value);
    return localStorage.getItem(key) === next;
  }

  function applyRemotePayload(payload = {}, updatedAt = null) {
    const state = stateFromPayload(payload);
    let changed = false;
    applyingRemote = true;
    try {
      for (const key of syncKeys) {
        if (!(key in state)) continue;
        const value = state[key];
        if (value == null) {
          if (localStorage.getItem(key) != null) {
            rawRemoveItem.call(localStorage, key);
            changed = true;
          }
          continue;
        }
        if (!sameValue(key, value)) {
          const next = typeof value === 'string' ? value : JSON.stringify(value);
          rawSetItem.call(localStorage, key, next);
          changed = true;
        }
      }
    } finally {
      applyingRemote = false;
    }

    if (updatedAt) lastRemoteUpdatedAt = updatedAt;
    if (!changed) return;

    window.dispatchEvent(new CustomEvent('rrn:inventory-remote-update', {
      detail: { tenantId, updatedAt }
    }));

    try { window.loadSetoresAndMachines?.(); } catch {}
    try { window.renderSetores?.(); } catch {}
    try { window.RRN_UI?.updateOverview?.(); } catch {}
    try { window.RRN_TABS?.renderHome?.(); } catch {}
    try { window.RRN_GRID_DETAILS?.enhanceAll?.(); } catch {}
    try { window.RRN_COMPACT_ACTIONS?.enhance?.(); } catch {}
    try { window.RRN_USER_ASSETS?.refreshCards?.(); } catch {}
  }

  async function fetchLatest() {
    if (!tenantId) return;
    const { data, error } = await client
      .from('tenant_inventory_state')
      .select('payload,updated_at')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return;
    applyRemotePayload(data.payload || {}, data.updated_at || null);
  }

  function subscribe() {
    if (!tenantId || channel) return;
    channel = client
      .channel(`rrn-inventory-${tenantId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tenant_inventory_state',
        filter: `tenant_id=eq.${tenantId}`
      }, event => {
        const row = event.new || {};
        if (!row.payload) return;
        if (row.updated_at && row.updated_at === lastRemoteUpdatedAt) return;
        applyRemotePayload(row.payload, row.updated_at || null);
      })
      .subscribe(status => {
        document.body.dataset.rrnSyncStatus = String(status || '').toLowerCase();
      });
  }

  function ensureStatusPill() {
    if (document.getElementById('rrnSyncStatus')) return;
    const nav = document.querySelector('.nav-links');
    if (!nav) return;
    const pill = document.createElement('span');
    pill.id = 'rrnSyncStatus';
    pill.className = 'rrn-sync-status';
    pill.innerHTML = '<span class="rrn-sync-dot"></span><span>Sincronizado</span>';
    nav.insertBefore(pill, nav.querySelector('.user-menu'));

    const style = document.createElement('style');
    style.textContent = `
      .rrn-sync-status{display:inline-flex;align-items:center;gap:7px;padding:7px 10px;border:1px solid var(--rrn-border,rgba(22,58,77,.14));border-radius:999px;background:var(--rrn-surface,#fff);color:var(--rrn-muted,#66757F);font-size:.72rem;font-weight:700;white-space:nowrap}
      .rrn-sync-dot{width:7px;height:7px;border-radius:50%;background:var(--rrn-secondary,#2F7D78);box-shadow:0 0 0 3px color-mix(in srgb,var(--rrn-secondary,#2F7D78) 14%,transparent)}
      body[data-rrn-sync-status="channel_error"] .rrn-sync-dot,body[data-rrn-sync-status="timed_out"] .rrn-sync-dot{background:var(--rrn-danger,#B9473A)}
      @media(max-width:900px){.rrn-sync-status{display:none}}
    `;
    document.head.appendChild(style);
  }

  async function boot() {
    ensureSearchAssets();
    const { data: { session } } = await client.auth.getSession();
    if (!session?.user) return;

    const sessionTenant = window.RRN_SESSION?.tenantId;
    if (sessionTenant) tenantId = sessionTenant;
    if (!tenantId) {
      const { data, error } = await client
        .from('profiles')
        .select('tenant_id,status')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data?.tenant_id || data.status !== 'active') return;
      tenantId = data.tenant_id;
    }

    ensureStatusPill();
    await fetchLatest();
    subscribe();

    window.addEventListener('online', () => fetchLatest().catch(console.warn));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') fetchLatest().catch(console.warn);
    });
  }

  window.RRN_REMOTE_SYNC = Object.freeze({
    refresh: () => fetchLatest(),
    isApplyingRemote: () => applyingRemote
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => boot().catch(error => console.warn('RRN sync:', error)), { once: true });
  } else {
    boot().catch(error => console.warn('RRN sync:', error));
  }
})();
