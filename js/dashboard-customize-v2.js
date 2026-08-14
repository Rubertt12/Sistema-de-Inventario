(() => {
  'use strict';
  if (window.__RRN_DASHBOARD_CUSTOMIZE_V2__) return;
  window.__RRN_DASHBOARD_CUSTOMIZE_V2__ = true;

  const KPI_DEFS = Object.freeze({
    assets: { label: 'Equipamentos', detail: 'Ativos cadastrados', icon: 'monitor' },
    sectors: { label: 'Setores', detail: 'Áreas com inventário', icon: 'building' },
    maintenance: { label: 'Manutenção', detail: 'Equipamentos indisponíveis', icon: 'wrench', warn: true },
    warranty: { label: 'Garantias', detail: 'Vencem nos próximos 60 dias', icon: 'shield', warn: true },
    operating: { label: 'Em operação', detail: 'Equipamentos disponíveis para uso', icon: 'check' },
    stock: { label: 'Em estoque', detail: 'Equipamentos sem uso operacional', icon: 'box' },
    borrowed: { label: 'Emprestados', detail: 'Equipamentos em uso temporário', icon: 'transfer' },
    unassigned: { label: 'Sem responsável', detail: 'Ativos sem usuário vinculado', icon: 'user', warn: true }
  });

  const DEFAULT_CONFIG = Object.freeze({
    version: 1,
    order: Object.keys(KPI_DEFS),
    visible: ['assets', 'sectors', 'maintenance', 'warranty']
  });

  let activeConfig = clone(DEFAULT_CONFIG);
  let draftConfig = null;
  let draggedKey = null;
  let inventoryObserver = null;
  let refreshQueued = false;

  function clone(value) {
    return {
      version: 1,
      order: [...(value?.order || DEFAULT_CONFIG.order)],
      visible: [...(value?.visible || DEFAULT_CONFIG.visible)]
    };
  }

  function normalize(value) {
    const valid = new Set(Object.keys(KPI_DEFS));
    const order = Array.isArray(value?.order) ? value.order.filter(key => valid.has(key)) : [];
    Object.keys(KPI_DEFS).forEach(key => { if (!order.includes(key)) order.push(key); });

    let visible = Array.isArray(value?.visible) ? value.visible.filter(key => valid.has(key)) : [];
    visible = [...new Set(visible)];
    if (!visible.length) visible = [...DEFAULT_CONFIG.visible];
    return { version: 1, order, visible };
  }

  function role() {
    if (window.RRN_SESSION?.role) return window.RRN_SESSION.role;
    try { return JSON.parse(localStorage.getItem('usuarioLogado') || '{}').perfil || null; }
    catch { return null; }
  }

  function isAdmin() { return role() === 'admin'; }

  function userId() {
    if (window.RRN_SESSION?.userId) return window.RRN_SESSION.userId;
    try { return JSON.parse(localStorage.getItem('usuarioLogado') || '{}').id || null; }
    catch { return null; }
  }

  function tenantId() {
    if (window.RRN_SESSION?.tenantId) return window.RRN_SESSION.tenantId;
    try { return JSON.parse(localStorage.getItem('usuarioLogado') || '{}').tenant_id || null; }
    catch { return null; }
  }

  function db() { return window.RRN_SUPABASE_CLIENT || null; }

  function cacheKey() {
    return `rrn_dashboard_kpis_${tenantId() || 'local'}_${userId() || 'user'}`;
  }

  function readCache() {
    try {
      const raw = localStorage.getItem(cacheKey());
      return raw ? normalize(JSON.parse(raw)) : clone(DEFAULT_CONFIG);
    } catch { return clone(DEFAULT_CONFIG); }
  }

  function writeCache(value) {
    try { localStorage.setItem(cacheKey(), JSON.stringify(normalize(value))); } catch {}
  }

  function inventorySectors() {
    try {
      if (typeof setores !== 'undefined' && Array.isArray(setores)) return setores;
    } catch {}
    try {
      const parsed = JSON.parse(localStorage.getItem('setores') || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  function parseDate(value) {
    if (!value) return null;
    const raw = String(value).trim();
    let match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
      return Number.isNaN(date.getTime()) ? null : date;
    }
    match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
      const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
      return Number.isNaN(date.getTime()) ? null : date;
    }
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function daysUntil(value) {
    const date = parseDate(value);
    if (!date) return null;
    const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
    return Math.ceil((end.getTime() - Date.now()) / 86400000);
  }

  function state(asset) {
    if (asset?.emManutencao) return 'maintenance';
    const status = String(asset?.situacaoPatrimonial || '').trim().toLowerCase();
    if (status.includes('estoque')) return 'stock';
    if (status.includes('emprest')) return 'borrowed';
    if (status.includes('baix') || status.includes('inativ')) return 'inactive';
    return 'operating';
  }

  function collectStats() {
    const allSectors = inventorySectors();
    const allAssets = allSectors.flatMap(sector => Array.isArray(sector?.maquinas) ? sector.maquinas : []);
    const byState = allAssets.reduce((acc, asset) => {
      const key = state(asset);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return {
      assets: allAssets.length,
      sectors: allSectors.length,
      maintenance: byState.maintenance || 0,
      warranty: allAssets.filter(asset => {
        const days = daysUntil(asset?.garantiaAte);
        return days != null && days >= 0 && days <= 60;
      }).length,
      operating: byState.operating || 0,
      stock: byState.stock || 0,
      borrowed: byState.borrowed || 0,
      unassigned: allAssets.filter(asset => !String(asset?.usuarioResponsavel || '').trim()).length
    };
  }

  function existingCardKey(card) {
    const explicit = card?.dataset?.kpiKey;
    if (explicit && KPI_DEFS[explicit]) return explicit;
    const label = card?.querySelector('.rrn-kpi-top > span:first-child')?.textContent?.trim().toLowerCase() || '';
    return Object.entries(KPI_DEFS).find(([, def]) => def.label.toLowerCase() === label)?.[0] || null;
  }

  function createCard(key) {
    const def = KPI_DEFS[key];
    const card = document.createElement('article');
    card.className = `rrn-kpi${def.warn ? ' warn' : ''}`;
    card.dataset.kpiKey = key;
    card.innerHTML = `
      <div class="rrn-kpi-top">
        <span>${def.label}</span>
        <span class="rrn-kpi-icon" data-rrn-icon="${def.icon}"></span>
      </div>
      <strong data-dashboard-kpi-value="${key}">0</strong>
      <small>${def.detail}</small>`;
    return card;
  }

  function ensureGrid() {
    const grid = document.querySelector('#rrnDashboardHome .rrn-kpi-grid');
    if (!grid) return null;

    grid.querySelectorAll(':scope > .rrn-kpi').forEach(card => {
      const key = existingCardKey(card);
      if (!key) return;
      card.dataset.kpiKey = key;
      const strong = card.querySelector('strong');
      if (strong) strong.dataset.dashboardKpiValue = key;
    });

    Object.keys(KPI_DEFS).forEach(key => {
      if (!grid.querySelector(`[data-kpi-key="${key}"]`)) grid.appendChild(createCard(key));
    });
    return grid;
  }

  function updateValues() {
    const grid = ensureGrid();
    if (!grid) return;
    const values = collectStats();
    Object.entries(values).forEach(([key, value]) => {
      const node = grid.querySelector(`[data-dashboard-kpi-value="${key}"]`);
      if (node && node.textContent !== String(value)) node.textContent = String(value);
    });
    window.RRN_ICONS?.decorateStatic?.(grid);
  }

  function apply(value = activeConfig) {
    const grid = ensureGrid();
    if (!grid) return;
    const config = normalize(value);
    const visible = new Set(config.visible);

    config.order.forEach(key => {
      const card = grid.querySelector(`[data-kpi-key="${key}"]`);
      if (!card) return;
      card.hidden = !visible.has(key);
      grid.appendChild(card);
    });
    grid.dataset.visibleCount = String(config.visible.length);
    updateValues();
  }

  function queueRefresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    requestAnimationFrame(() => {
      refreshQueued = false;
      refresh();
    });
  }

  function ensureButton() {
    const host = document.querySelector('#rrnDashboardHome .rrn-home-actions');
    if (!host) return;
    const current = host.querySelector('[data-dashboard-customize]');
    if (!isAdmin()) {
      current?.remove();
      return;
    }
    if (current) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rrn-home-action admin-only';
    button.dataset.dashboardCustomize = '1';
    button.dataset.rrnIcon = 'settings';
    button.textContent = 'Personalizar painel';
    button.addEventListener('click', openEditor);
    host.appendChild(button);
    window.RRN_ICONS?.decorateStatic?.(button);
  }

  function ensureModal() {
    let modal = document.getElementById('rrnDashboardCustomizeModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'rrnDashboardCustomizeModal';
    modal.className = 'rrn-admin-tools-modal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="rrn-admin-tools-card" role="dialog" aria-modal="true" aria-labelledby="rrnDashboardCustomizeTitle">
        <div class="rrn-admin-tools-head">
          <div class="rrn-admin-tools-title">
            <span>Dashboard executivo</span>
            <h3 id="rrnDashboardCustomizeTitle">Personalizar indicadores</h3>
            <p>Arraste os indicadores para definir a ordem e escolha quais KPIs aparecem na sua visão.</p>
          </div>
          <button type="button" class="rrn-admin-tools-close" data-dashboard-editor-close aria-label="Fechar">×</button>
        </div>
        <div class="rrn-admin-tools-body">
          <div class="rrn-admin-tools-note">Sua configuração fica vinculada à sua conta de administrador e acompanha você em outros dispositivos.</div>
          <div class="rrn-kpi-config-list" data-dashboard-kpi-editor></div>
        </div>
        <div class="rrn-admin-tools-footer">
          <button type="button" class="rrn-admin-btn" data-dashboard-editor-default data-rrn-icon="refresh">Restaurar padrão</button>
          <div class="rrn-admin-tools-footer-group">
            <button type="button" class="rrn-admin-btn" data-dashboard-editor-cancel>Cancelar</button>
            <button type="button" class="rrn-admin-btn primary" data-dashboard-editor-save data-rrn-icon="save">Salvar painel</button>
          </div>
        </div>
      </div>`;

    document.body.appendChild(modal);
    modal.querySelector('[data-dashboard-editor-close]')?.addEventListener('click', closeEditor);
    modal.querySelector('[data-dashboard-editor-cancel]')?.addEventListener('click', closeEditor);
    modal.querySelector('[data-dashboard-editor-default]')?.addEventListener('click', () => {
      draftConfig = clone(DEFAULT_CONFIG);
      renderEditor();
      apply(draftConfig);
    });
    modal.querySelector('[data-dashboard-editor-save]')?.addEventListener('click', saveEditor);
    modal.addEventListener('click', event => { if (event.target === modal) closeEditor(); });
    window.RRN_ICONS?.decorateStatic?.(modal);
    return modal;
  }

  function renderEditor() {
    if (!draftConfig) return;
    const modal = ensureModal();
    const list = modal.querySelector('[data-dashboard-kpi-editor]');
    if (!list) return;
    const visible = new Set(draftConfig.visible);

    list.innerHTML = draftConfig.order.map(key => {
      const def = KPI_DEFS[key];
      return `
        <div class="rrn-kpi-config-item" draggable="true" data-kpi-editor-key="${key}">
          <span class="rrn-kpi-drag" aria-hidden="true"></span>
          <div class="rrn-kpi-config-copy">
            <strong>${def.label}</strong>
            <small>${def.detail}</small>
          </div>
          <label class="rrn-kpi-toggle" title="Mostrar ou ocultar ${def.label}">
            <input type="checkbox" data-kpi-editor-visible="${key}" ${visible.has(key) ? 'checked' : ''}>
            <span></span>
          </label>
        </div>`;
    }).join('');

    list.querySelectorAll('[data-kpi-editor-visible]').forEach(input => {
      input.addEventListener('change', () => {
        const key = input.dataset.kpiEditorVisible;
        const nextVisible = new Set(draftConfig.visible);
        if (input.checked) nextVisible.add(key);
        else nextVisible.delete(key);
        if (!nextVisible.size) {
          input.checked = true;
          return;
        }
        draftConfig.visible = draftConfig.order.filter(item => nextVisible.has(item));
        apply(draftConfig);
      });
    });

    list.querySelectorAll('[data-kpi-editor-key]').forEach(item => {
      item.addEventListener('dragstart', event => {
        draggedKey = item.dataset.kpiEditorKey;
        item.classList.add('is-dragging');
        event.dataTransfer?.setData('text/plain', draggedKey);
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
      });
      item.addEventListener('dragend', () => {
        draggedKey = null;
        list.querySelectorAll('.is-dragging,.is-drop-target').forEach(el => el.classList.remove('is-dragging', 'is-drop-target'));
      });
      item.addEventListener('dragover', event => {
        event.preventDefault();
        if (draggedKey && draggedKey !== item.dataset.kpiEditorKey) item.classList.add('is-drop-target');
      });
      item.addEventListener('dragleave', () => item.classList.remove('is-drop-target'));
      item.addEventListener('drop', event => {
        event.preventDefault();
        item.classList.remove('is-drop-target');
        const sourceKey = draggedKey || event.dataTransfer?.getData('text/plain');
        const targetKey = item.dataset.kpiEditorKey;
        if (!sourceKey || sourceKey === targetKey) return;
        const order = [...draftConfig.order];
        const from = order.indexOf(sourceKey);
        const to = order.indexOf(targetKey);
        if (from < 0 || to < 0) return;
        order.splice(from, 1);
        order.splice(to, 0, sourceKey);
        draftConfig.order = order;
        draftConfig.visible = order.filter(key => draftConfig.visible.includes(key));
        renderEditor();
        apply(draftConfig);
      });
    });
  }

  function openEditor() {
    if (!isAdmin()) return;
    draftConfig = clone(activeConfig);
    const modal = ensureModal();
    renderEditor();
    modal.hidden = false;
    document.documentElement.style.overflow = 'hidden';
  }

  function closeEditor() {
    document.getElementById('rrnDashboardCustomizeModal')?.setAttribute('hidden', '');
    draftConfig = null;
    apply(activeConfig);
    document.documentElement.style.removeProperty('overflow');
  }

  async function saveEditor() {
    if (!draftConfig || !isAdmin()) return;
    const button = document.querySelector('[data-dashboard-editor-save]');
    const originalText = button?.textContent || 'Salvar painel';
    if (button) { button.disabled = true; button.textContent = 'Salvando...'; }

    try {
      const client = db();
      const uid = userId();
      const tid = tenantId();
      if (!client || !uid || !tid) throw new Error('Sessão do administrador ainda não está pronta.');
      const next = normalize(draftConfig);
      const { error } = await client.from('dashboard_preferences').upsert({
        user_id: uid,
        tenant_id: tid,
        config: next,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,tenant_id' });
      if (error) throw error;

      activeConfig = clone(next);
      writeCache(activeConfig);
      apply(activeConfig);
      const modal = document.getElementById('rrnDashboardCustomizeModal');
      if (modal) modal.hidden = true;
      draftConfig = null;
      document.documentElement.style.removeProperty('overflow');
    } catch (error) {
      console.warn('RRN dashboard preferences:', error);
      alert(`Não foi possível salvar o painel: ${error.message || 'erro inesperado'}`);
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
        button.dataset.rrnSvgIcon = '';
        window.RRN_ICONS?.decorateStatic?.(button);
      }
    }
  }

  async function loadPreference() {
    activeConfig = isAdmin() ? readCache() : clone(DEFAULT_CONFIG);
    apply(activeConfig);
    if (!isAdmin()) return;

    const client = db();
    const uid = userId();
    const tid = tenantId();
    if (!client || !uid || !tid) return;

    try {
      const { data, error } = await client
        .from('dashboard_preferences')
        .select('config')
        .eq('user_id', uid)
        .eq('tenant_id', tid)
        .maybeSingle();
      if (error) throw error;
      activeConfig = data?.config ? normalize(data.config) : clone(DEFAULT_CONFIG);
      writeCache(activeConfig);
      apply(activeConfig);
    } catch (error) {
      console.warn('RRN dashboard preferences:', error);
    }
  }

  function installInventoryObserver() {
    const root = document.getElementById('setoresContainer');
    if (!root || inventoryObserver) return;
    inventoryObserver = new MutationObserver(queueRefresh);
    inventoryObserver.observe(root, { childList: true, subtree: true });
  }

  function refresh() {
    ensureGrid();
    ensureButton();
    apply(activeConfig);
  }

  function boot() {
    refresh();
    installInventoryObserver();
    loadPreference();

    window.addEventListener('rrn:session-ready', () => {
      ensureButton();
      loadPreference();
    });
    window.addEventListener('rrn:inventory-remote-update', queueRefresh);
    window.addEventListener('storage', event => { if (event.key === 'setores') queueRefresh(); });
    window.addEventListener('hashchange', () => setTimeout(refresh, 0));
    window.addEventListener('keydown', event => {
      const modal = document.getElementById('rrnDashboardCustomizeModal');
      if (event.key === 'Escape' && modal && !modal.hidden) closeEditor();
    });
  }

  window.RRN_DASHBOARD_CUSTOMIZE = Object.freeze({
    refresh,
    open: openEditor,
    getConfig: () => clone(activeConfig)
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
