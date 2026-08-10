(() => {
  'use strict';

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  function inventory() {
    try {
      if (typeof setores !== 'undefined' && Array.isArray(setores)) return setores;
    } catch {}
    try {
      const parsed = JSON.parse(localStorage.getItem('setores') || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function maintenanceAssets() {
    const result = [];
    inventory().forEach((sector, sectorIndex) => {
      (Array.isArray(sector?.maquinas) ? sector.maquinas : []).forEach((asset, assetIndex) => {
        if (!asset?.emManutencao) return;
        result.push({
          asset,
          sectorIndex,
          assetIndex,
          sectorName: sector?.nome || `Setor ${sectorIndex + 1}`
        });
      });
    });
    return result;
  }

  function assetLabel(item) {
    const asset = item.asset || {};
    const primary = asset.etiqueta || asset.nome || 'Sem identificação';
    const type = asset.tipo || 'Equipamento';
    return `${escapeHtml(type)} · ${escapeHtml(primary)}`;
  }

  function openAsset(sectorIndex, assetIndex) {
    if (typeof window.showInfo === 'function') window.showInfo(sectorIndex, assetIndex);
  }

  function renderPanel() {
    const panel = document.getElementById('painelManutencao');
    if (!panel) return;

    const items = maintenanceAssets();
    const visible = items.slice(0, 5);
    const collapsed = panel.classList.contains('recolhido');

    panel.innerHTML = `
      <div class="painel-header" role="button" tabindex="0" aria-expanded="${collapsed ? 'false' : 'true'}">
        <span>🛠️ Máquinas em Manutenção</span>
        <span class="rrn-maintenance-badge">${items.length}</span>
        <span id="painelToggleIcon">${collapsed ? '◀' : '▶'}</span>
      </div>
      <div class="painel-conteudo">
        ${items.length === 0
          ? '<p style="padding:10px;">Nenhuma máquina em manutenção.</p>'
          : visible.map(item => `
              <div class="maquina-box">
                <strong>${assetLabel(item)}</strong><br>
                <small>Setor: ${escapeHtml(item.sectorName)}</small><br>
                <button type="button" data-maintenance-open="${item.sectorIndex}:${item.assetIndex}">🔍 Ver detalhes</button>
              </div>`).join('')}
        ${items.length > 5 ? `
          <div style="text-align:center;margin-top:10px;">
            <button type="button" data-maintenance-all>Ver todas (${items.length})</button>
          </div>` : ''}
      </div>`;

    panel.querySelector('.painel-header')?.addEventListener('click', togglePanel);
    panel.querySelector('.painel-header')?.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        togglePanel();
      }
    });
    panel.querySelectorAll('[data-maintenance-open]').forEach(button => {
      button.addEventListener('click', () => {
        const [sectorIndex, assetIndex] = button.dataset.maintenanceOpen.split(':').map(Number);
        openAsset(sectorIndex, assetIndex);
      });
    });
    panel.querySelector('[data-maintenance-all]')?.addEventListener('click', openAllModal);
  }

  function togglePanel() {
    const panel = document.getElementById('painelManutencao');
    if (!panel) return;
    panel.classList.toggle('recolhido');
    renderPanel();
  }

  function openAllModal() {
    const modal = document.getElementById('modalTodasManutencoes');
    const list = document.getElementById('listaTodasManutencoes');
    if (!modal || !list) return;

    const items = maintenanceAssets();
    list.innerHTML = items.length
      ? items.map(item => `
          <div class="maquina-box">
            <strong>${assetLabel(item)}</strong><br>
            <small>Setor: ${escapeHtml(item.sectorName)}</small><br>
            <button type="button" data-maintenance-modal-open="${item.sectorIndex}:${item.assetIndex}">🔍 Ver detalhes</button>
          </div>`).join('')
      : '<p>Nenhuma máquina em manutenção.</p>';

    list.querySelectorAll('[data-maintenance-modal-open]').forEach(button => {
      button.addEventListener('click', () => {
        const [sectorIndex, assetIndex] = button.dataset.maintenanceModalOpen.split(':').map(Number);
        closeAllModal();
        openAsset(sectorIndex, assetIndex);
      });
    });

    modal.style.display = 'flex';
  }

  function closeAllModal() {
    const modal = document.getElementById('modalTodasManutencoes');
    if (modal) modal.style.display = 'none';
  }

  function installObservers() {
    const sectorsContainer = document.getElementById('setoresContainer');
    if (sectorsContainer) {
      const observer = new MutationObserver(() => renderPanel());
      observer.observe(sectorsContainer, { childList: true, subtree: true });
    }
    window.addEventListener('storage', event => {
      if (event.key === 'setores') renderPanel();
    });
  }

  function boot() {
    renderPanel();
    installObservers();
  }

  window.renderPainelManutencao = renderPanel;
  window.togglePainelManutencao = togglePanel;
  window.abrirModalTodasManutencoes = openAllModal;
  window.fecharModalTodasManutencoes = closeAllModal;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
  window.addEventListener('load', renderPanel);
})();
