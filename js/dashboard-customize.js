(() => {
  'use strict';
  if (window.__RRN_DASHBOARD_CUSTOMIZE__) return;
  window.__RRN_DASHBOARD_CUSTOMIZE__ = true;

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

  let activeConfig = cloneConfig(DEFAULT_CONFIG);
  let editorConfig = null;
  let draggedKey = null;
  let loaded = false;

  function cloneConfig(config) {
    return {
      version: 1,
      order: [...(config?.order || DEFAULT_CONFIG.order)],
      visible: [...(config?.visible || DEFAULT_CONFIG.visible)]
    };
  }

  function normalizeConfig(config) {
    const valid = new Set(Object.keys(KPI_DEFS));
    const order = Array.isArray(config?.order) ? config.order.filter(key => valid.has(key)) : [];
    Object.keys(KPI_DEFS).forEach(key => { if (!order.includes(key)) order.push(key); });

    let visible = Array.isArray(config?.visible) ? config.visible.filter(key => valid.has(key)) : [];
    visible = [...new Set(visible)];
    if (!visible.length) visible = [...DEFAULT_CONFIG.visible];

    return { version: 1, order, visible };
  }

  function currentRole() {
    if (window.RRN_SESSION?.role) return window.RRN_SESSION.role;
    try { return JSON.parse(localStorage.getItem('usuarioLogado') || '{}').perfil || null; }
    catch { return null; }
  }

  function isAdmin() {
    return currentRole() === 'admin';
  }

  function currentUserId() {
    if (window.RRN_SESSION?.userId) return window.RRN_SESSION.userId;
    try { return JSON.parse(localStorage.getItem('usuarioLogado') || '{}').id || null; }
    catch { return null; }
  }

  function currentTenantId() {
    if (window.RRN_SESSION?.tenantId) return window.RRN_SESSION.tenantId;
    try { return JSON.parse(localStorage.getItem('usuarioLogado') || '{}').tenant_id || null; }
    catch { return null; }
  }

  function getClient() {
    return window.RRN_SUPABASE_CLIENT || null;
  }

  function storageKey() {
    return `rrn_dashboard_kpis_${currentTenantId() || 'local'}_${currentUserId() || 'user'}`;
  }

  function readLocalPreference() {
    try { return normalizeConfig(JSON.parse(localStorage.getItem(storageKey()) || 'null')); }
    catch { return cloneConfig(DEFAULT_CONFIG); }
  }

  function saveLocalPreference(config) {
    try { localStorage.setItem(storageKey(), JSON.stringify(normalizeConfig(config))); } catch {}
  }

  function sectors() {
    try { if (typeof window.setores !== 'undefined' && Array.isArray(window.setores)) return window.setores; } catch {}
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
      const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
      const parsed = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function daysUntil(value) {
    const date = parseDate(value);
    if (!date) return null;
    const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
    return Math.ceil((end.getTime() - Date.now()) / 86400000);
  }

  function assetState(asset) {
    if (asset?.emManutencao) return 'maintenance';
    const status = String(asset?.situacaoPatrimonial || '').trim().toLowerCase();
    if (status.includes('estoque')) return 'stock';
    if (status.includes('emprest')) return 'borrowed';
    if (status.includes('baix') || status.includes('inativ')) return 'inactive';
    return 'operating';
  }

  function stats() {
    const allSectors = sectors();
    const allAssets = allSectors.flatMap(sector => Array.isArray(sector?.maquinas) ? sector.maquinas : []);
    const states = allAssets.reduce((acc, asset) => {
      const state = assetState(asset);
      acc[state] = (acc[state] || 0) + 1;
      return acc;
    }, {});
    return {
      assets: allAssets.length,
      sectors: allSectors.length,
      maintenance: states.maintenance || 0,
      warranty: allAssets.filter(asset => {
        const days = daysUntil(asset?.garantiaAte);
        return days != null && days >= 0 && days <= 60;
      }).length,
      operating: states.operating || 0,
      stock: states.stock || 0,
      borrowed: states.borrowed || 0,
      unassigned: allAssets.filter(asset => !String(asset?.usuarioResponsavel || '').trim()).length
    };
  }

  function keyFromExistingCard(card) {
    if (card?.dataset?.kpiKey && KPI_DEFS[card.dataset.kpiKey]) return card.dataset.kpiKey;
    const label = card?.querySelector('.rrn-kpi-top > span:first-child')?.textContent?.trim().toLowerCase() || '';
    const match = Object.entries(KPI_DEFS).find(([, def]) => def.label.toLowerCase() === label);
    return match?.[0] || null;
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

  function ensureCards() {
    const grid = document.querySelector('#rrnDashboardHome .rrn-kpi-grid');
    if (!grid) return null;

    [...grid.querySelectorAll(':scope > .rrn-kpi')].forEach(card => {
      const key = keyFromExistingCard(card);
      if (!key) return;
      card.dataset.kpiKey = key;
      const strong = card.querySelector('strong');
      if (strong) strong.dataset.dashboardKpiValue = key;
    });

    Object.keys(KPI_DEFS).forEach(key => {
      if (!grid.querySelector(`.rrn-kpi[data-kpi-key="${key}"]`)) grid.appendChild(createCard(key));
    });

    return grid;
  }

  function updateValues() {
    const grid = ensureCards();
    if (!grid) return;
    const current = stats();
    Object.entries(current).forEach(([key, value]) => {
      grid.querySelector(`[data-dashboard-kpi-value="${key}"]`)?.replaceChildren(document.createTextNode(String(value)));
    });
    window.RRN_ICONS?.decorateStatic?.(grid);
  }

  function applyConfig(config) {
    const grid = ensureCards();
    if (!grid) return;
    const next = normalizeConfig(config);
    const visible = new Set(next.visible);

    next.order.forEach(key => {
      const card = grid.querySelector(`.rrn-kpi[data-kpi-key="${key}"]`);
      if (!card) return;
      card.hidden = !visible.has(key);
      grid.appendChild(card);
    });

    grid.dataset.visibleCount = String(next.visible.length);
    updateValues();
  }

  function ensureCustomizeButton() {
    const host = document.querySelector('#rrnDashboardHome .rrn-home-actions');
    if (!host) return;
    const existing = host.querySelector('[data-dashboard-customize]');
    if (!isAdmin()) {
      existing?.remove();
      return;
    }
    if (existing) return;

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
            <p>Arraste os cards para definir a ordem e escolha quais KPIs devem aparecer na sua visão.</p>
          </div>
          <button type="button" class="rrn-admin-tools-close" data-dashboard-editor-close aria-label="Fechar">×</button>
        </div>
        <div class="rrn-admin-tools-body">
          <div class="rrn-admin-tools-note">A configuração é salva na sua conta de administrador e acompanha você em outros dispositivos.</div>
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
      editorConfig = cloneConfig(DEFAULT_CONFIG);
      renderEditor();
      applyConfig(editorConfig);
    });
    modal.querySelector('[data-dashboard-editor-save]')?.addEventListener('click', saveEditor);
    modal.addEventListener('click', event => { if (event.target === modal) closeEditor(); });
    window.RRN_ICONS?.decorateStatic?.(modal);
    return modal;
  }

  function renderEditor() {
    const modal = ensureModal();
    const list = modal.querySelector('[data-dashboard-kpi-editor]');
    if (!list || !editorConfig) return;
    const visible = new Set(editorConfig.visible);

    list.innerHTML = editorConfig.order.map(key => {
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
        const set = new Set(editorConfig.visible);
        if (input.checked) set.add(key);
        else set.delete(key);
        if (!set.size) {
          input.checked = true;
          return;
        }
        editorConfig.visible = editorConfig.order.filter(item => set.has(item));
        applyConfig(editorConfig);
      });
    });

    list.querySelectorAll('[data-kpi-editor-key]').forEach(item => {
      item.addEventListener('dragstart', () => {
        draggedKey = item.dataset.kpiEditorKey;
        item.classList.add('is-dragging');
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
        const targetKey = item.dataset.kpiEditorKey;
        if (!draggedKey || draggedKey === targetKey) return;
        const order = [...editorConfig.order];
        const from = order.indexOf(draggedKey);
        const to = order.indexOf(targetKey);
        if (from < 0 || to < 0) return;
        order.splice(from, 1);
        order.splice(to, 0, draggedKey);
        editorConfig.order = order;
        editorConfig.visible = order.filter(key => editorConfig.visible.includes(key));
        renderEditor();
        applyConfig(editorConfig);
      });
    });
  }

  function openEditor() {
    if (!isAdmin()) return;
    editorConfig = cloneConfig(activeConfig);
    const modal = ensureModal();
    renderEditor();
    modal.hidden = false;
    document.documentElement.style.overflow = 'hidden';
  }

  function closeEditor() {
    const modal = document.getElementById('rrnDashboardCustomizeModal');
    if (modal) modal.hidden = true;
    editorConfig = null;
    applyConfig(activeConfig);
    document.documentElement.style.removeProperty('overflow');
  }

  async function saveEditor() {
    if (!editorConfig || !isAdmin()) return;
    const button = document.querySelector('[data-dashboard-editor-save]');
    if (button) { button.disabled = true; button.textContent = 'Salvando...'; }
    try {
      const next = normalizeConfig(editorConfig);
      const client = getClient();
      const userId = currentUserId();
      const tenantId = currentTenantId();
      if (!client || !userId || !tenantId) throw new Error('Sessão do administrador não está pronta.');

      const { error } = await client.from('dashboard_preferences').upsert({
        user_id: userId,
        tenant_id: tenantId,
        config: next,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,tenant_id' });
      if (error) throw error;

      activeConfig = cloneConfig(next);
      saveLocalPreference(activeConfig);
      applyConfig(activeConfig);
      const modal = document.getElementById('rrnDashboardCustomizeModal');
      if (modal) modal.hidden = true;
      editorConfig = null;
      document.documentElement.style.removeProperty('overflow');
    } catch (error) {
      console.warn('RRN dashboard preferences:', error);
      alert(`Não foi possível salvar o painel: ${error.message || 'erro inesperado'}`);
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = 'Salvar painel';
        button.dataset.rrnSvgIcon = '';
        window.RRN_ICONS?.decorateStatic?.(button);
      }
    }
  }

  async function loadPreference() {
    const local = readLocalPreference();
    activeConfig = cloneConfig(local);
    applyConfig(activeConfig);

    if (!isAdmin()) {
      activeConfig = cloneConfig(DEFAULT_CONFIG);
      applyConfig(activeConfig);
      loaded = true;
      return;
    }

    const client = getClient();
    const userId = currentUserId();
    const tenantId = currentTenantId();
    if (!client || !userId || !tenantId) return;

    try {
      const { data, error } = await client
        .from('dashboard_preferences')
        .select('config')
        .eq('user_id', userId)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (error) throw error;
      if (data?.config) {
        activeConfig = normalizeConfig(data.config);
        saveLocalPreference(activeConfig);
      } else {
        activeConfig = cloneConfig(DEFAULT_CONFIG);
      }
      applyConfig(activeConfig);
      loaded = true;
    } catch (error) {
      console.warn('RRN dashboard preferences:', error);
      loaded = true;
    }
  }

  function refresh() {
    ensureCards();
    ensureCustomizeButton();
    updateValues();
    applyConfig(activeConfig);
  }

  function boot() {
    refresh();
    loadPreference();

    window.addEventListener('rrn:session-ready', () => {
      ensureCustomizeButton();
      loadPreference();
    });
    window.addEventListener('rrn:inventory-remote-update', refresh);
    window.addEventListener('storage', event => { if (event.key === 'setores') refresh(); });
    window.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !document.getElementById('rrnDashboardCustomizeModal')?.hidden) closeEditor();
    });

    const root = document.getElementById('rrnDashboardHome');
    if (root) {
      let scheduled = false;
      new MutationObserver(() => {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
          scheduled = false;
          ensureCustomizeButton();
          if (loaded) updateValues();
        });
      }).observe(root, { childList: true, subtree: true });
    }
  }

  window.RRN_DASHBOARD_CUSTOMIZE = Object.freeze({
    refresh,
    open: openEditor,
    getConfig: () => cloneConfig(activeConfig)
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
