(() => {
  'use strict';
  if (window.__RRN_MAINTENANCE_DRAWER_V4__) return;
  window.__RRN_MAINTENANCE_DRAWER_V4__ = true;

  const STORAGE_KEY = 'rrn_maintenance_drawer_open';
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  function inventory() {
    try { if (typeof setores !== 'undefined' && Array.isArray(setores)) return setores; } catch {}
    try {
      const parsed = JSON.parse(localStorage.getItem('setores') || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  function maintenanceAssets() {
    const result = [];
    inventory().forEach((sector, sectorIndex) => {
      (Array.isArray(sector?.maquinas) ? sector.maquinas : []).forEach((asset, assetIndex) => {
        if (!asset?.emManutencao) return;
        result.push({ asset, sectorIndex, assetIndex, sectorName: sector?.nome || `Setor ${sectorIndex + 1}` });
      });
    });
    return result;
  }

  function assetLabel(item) {
    const asset = item.asset || {};
    return `${escapeHtml(asset.tipo || 'Equipamento')} · ${escapeHtml(asset.etiqueta || asset.nome || 'Sem identificação')}`;
  }

  function ensurePanel() {
    let panel = document.getElementById('painelManutencao');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'painelManutencao';
      panel.setAttribute('aria-live', 'polite');
      document.body.appendChild(panel);
    } else if (panel.parentElement !== document.body) {
      document.body.appendChild(panel);
    }
    panel.classList.add('rrn-maintenance-drawer');
    return panel;
  }

  function openAsset(sectorIndex, assetIndex) {
    if (typeof window.showInfo === 'function') window.showInfo(sectorIndex, assetIndex);
  }

  function isOpen() {
    return Boolean(ensurePanel().classList.contains('rrn-maintenance-drawer--open'));
  }

  function setOpen(open, persist = true) {
    const panel = ensurePanel();
    panel.classList.toggle('rrn-maintenance-drawer--open', open);
    panel.classList.toggle('recolhido', !open);
    panel.setAttribute('aria-expanded', String(open));
    if (persist) sessionStorage.setItem(STORAGE_KEY, open ? '1' : '0');
    renderPanel();
  }

  function togglePanel() { setOpen(!isOpen()); }

  function renderPanel() {
    const panel = ensurePanel();
    const items = maintenanceAssets();
    const visible = items.slice(0, 5);
    const open = panel.classList.contains('rrn-maintenance-drawer--open');

    panel.innerHTML = `
      <button class="rrn-maintenance-handle" type="button" aria-label="Abrir máquinas em manutenção" title="Abrir manutenção · Ctrl+M">
        <span class="rrn-maintenance-handle-grip" aria-hidden="true"></span>
        <span class="rrn-maintenance-handle-label">Manutenção</span>
        <span class="rrn-maintenance-badge">${items.length}</span>
      </button>
      <section class="rrn-maintenance-sheet" aria-label="Máquinas em manutenção" aria-hidden="${open ? 'false' : 'true'}">
        <header class="rrn-maintenance-sheet-head">
          <div><span class="rrn-maintenance-kicker">Acompanhamento</span><strong>Máquinas em manutenção</strong><small>${items.length} item${items.length === 1 ? '' : 's'} em acompanhamento</small></div>
          <div class="rrn-maintenance-sheet-actions"><kbd>Ctrl+M</kbd><button type="button" data-maintenance-close>Fechar</button></div>
        </header>
        <div class="rrn-maintenance-list">
          ${items.length === 0
            ? '<div class="rrn-maintenance-empty"><strong>Nenhuma máquina em manutenção</strong><small>Quando um equipamento entrar em manutenção, ele aparecerá aqui.</small></div>'
            : visible.map(item => `<article class="rrn-maintenance-card"><div class="rrn-maintenance-card-copy"><strong>${assetLabel(item)}</strong><small>Setor: ${escapeHtml(item.sectorName)}</small></div><button type="button" data-maintenance-open="${item.sectorIndex}:${item.assetIndex}">Ver detalhes</button></article>`).join('')}
          ${items.length > 5 ? `<button type="button" class="rrn-maintenance-all" data-maintenance-all>Ver todas as ${items.length} máquinas</button>` : ''}
        </div>
      </section>`;

    panel.querySelector('.rrn-maintenance-handle')?.addEventListener('click', togglePanel);
    panel.querySelector('[data-maintenance-close]')?.addEventListener('click', () => setOpen(false));
    panel.querySelectorAll('[data-maintenance-open]').forEach(button => button.addEventListener('click', () => {
      const [sectorIndex, assetIndex] = button.dataset.maintenanceOpen.split(':').map(Number);
      openAsset(sectorIndex, assetIndex);
    }));
    panel.querySelector('[data-maintenance-all]')?.addEventListener('click', openAllModal);
  }

  function openAllModal() {
    const modal = document.getElementById('modalTodasManutencoes');
    const list = document.getElementById('listaTodasManutencoes');
    if (!modal || !list) return;
    const items = maintenanceAssets();
    list.innerHTML = items.length
      ? items.map(item => `<article class="rrn-maintenance-card rrn-maintenance-card--modal"><div class="rrn-maintenance-card-copy"><strong>${assetLabel(item)}</strong><small>Setor: ${escapeHtml(item.sectorName)}</small></div><button type="button" data-maintenance-modal-open="${item.sectorIndex}:${item.assetIndex}">Ver detalhes</button></article>`).join('')
      : '<div class="rrn-maintenance-empty"><strong>Nenhuma máquina em manutenção</strong></div>';

    list.querySelectorAll('[data-maintenance-modal-open]').forEach(button => button.addEventListener('click', () => {
      const [sectorIndex, assetIndex] = button.dataset.maintenanceModalOpen.split(':').map(Number);
      closeAllModal();
      openAsset(sectorIndex, assetIndex);
    }));

    modal.classList.add('rrn-maintenance-modal-open');
    modal.style.display = 'flex';
    requestAnimationFrame(() => modal.querySelector('.modal-content')?.scrollTo({ top: 0 }));
  }

  function closeAllModal() {
    const modal = document.getElementById('modalTodasManutencoes');
    if (!modal) return;
    modal.classList.remove('rrn-maintenance-modal-open');
    modal.style.display = 'none';
  }

  function bindShortcut() {
    if (window.__RRN_MAINTENANCE_SHORTCUT_BOUND__) return;
    window.__RRN_MAINTENANCE_SHORTCUT_BOUND__ = true;
    document.addEventListener('keydown', event => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || String(event.key).toLowerCase() !== 'm') return;
      if (event.target?.matches?.('input,textarea,select,[contenteditable="true"]')) return;
      event.preventDefault();
      togglePanel();
    });
  }

  function installObservers() {
    const sectorsContainer = document.getElementById('setoresContainer');
    if (sectorsContainer) new MutationObserver(renderPanel).observe(sectorsContainer, { childList: true, subtree: true });
    window.addEventListener('storage', event => { if (event.key === 'setores') renderPanel(); });
    window.addEventListener('rrn:inventory-remote-update', renderPanel);
  }

  function boot() {
    const panel = ensurePanel();
    const saved = sessionStorage.getItem(STORAGE_KEY) === '1';
    panel.classList.toggle('rrn-maintenance-drawer--open', saved);
    panel.classList.toggle('recolhido', !saved);
    renderPanel();
    bindShortcut();
    installObservers();
  }

  window.renderPainelManutencao = renderPanel;
  window.togglePainelManutencao = togglePanel;
  window.abrirModalTodasManutencoes = openAllModal;
  window.fecharModalTodasManutencoes = closeAllModal;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();