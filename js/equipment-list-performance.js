(() => {
  'use strict';

  const PAGE_SIZE = 32;
  const visibleBySector = new Map();

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  function equipmentIcon(type) {
    const value = String(type || '').toLowerCase();
    if (value.includes('notebook')) return '💻';
    if (value.includes('monitor')) return '🖥️';
    if (value.includes('impress')) return '🖨️';
    if (value.includes('workstation')) return '🧰';
    return '🖥️';
  }

  function canOperate() {
    const role = window.RRN_SESSION?.role;
    if (role) return role !== 'monitoramento';
    try {
      return JSON.parse(localStorage.getItem('usuarioLogado') || '{}').perfil !== 'monitoramento';
    } catch {
      return true;
    }
  }

  function getVisibleCount(sectorIndex) {
    return visibleBySector.get(sectorIndex) || PAGE_SIZE;
  }

  function resetVisibleCount(sectorIndex) {
    visibleBySector.set(sectorIndex, PAGE_SIZE);
  }

  function installRenderer() {
    try {
      if (typeof setores === 'undefined' || typeof setoresVisiveis === 'undefined') return false;
    } catch {
      return false;
    }

    const render = function renderSetoresPaged(termoBusca = null) {
      const container = document.getElementById('setoresContainer');
      if (!container) return;

      const term = String(termoBusca || '').trim().toLowerCase();
      const sectorList = Array.isArray(setores) ? setores : [];
      const baseIndices = (typeof setoresFiltradosIndices !== 'undefined' && setoresFiltradosIndices != null)
        ? setoresFiltradosIndices
        : sectorList.map((_, index) => index);

      const visibleIndices = baseIndices.filter(index => {
        const sector = sectorList[index];
        if (!sector) return false;
        if (!term) return true;
        if (String(sector.nome || '').toLowerCase().includes(term)) return true;
        return (Array.isArray(sector.maquinas) ? sector.maquinas : []).some(asset => [
          asset?.nome,
          asset?.tipo,
          asset?.etiqueta,
          asset?.usuarioResponsavel,
          asset?.fabricante,
          asset?.modelo
        ].some(value => String(value || '').toLowerCase().includes(term)));
      });

      container.replaceChildren();

      if (!visibleIndices.length) {
        container.innerHTML = `
          <div class="rrn-empty-state">
            <span>🔎</span>
            <strong>Nenhum setor ou equipamento encontrado</strong>
            <small>Tente outro termo de pesquisa ou crie um novo setor.</small>
          </div>`;
        document.getElementById('setoresPaginacao')?.remove();
        window.RRN_UI?.updateOverview?.();
        return;
      }

      const perPage = (typeof setoresPorPagina === 'number' && setoresPorPagina > 0) ? setoresPorPagina : 10;
      const totalPages = Math.max(1, Math.ceil(visibleIndices.length / perPage));
      if (typeof paginaSetoresAtual !== 'number' || paginaSetoresAtual < 1) paginaSetoresAtual = 1;
      if (paginaSetoresAtual > totalPages) paginaSetoresAtual = totalPages;

      const start = (paginaSetoresAtual - 1) * perPage;
      const pageIndices = visibleIndices.slice(start, start + perPage);
      const mayOperate = canOperate();
      const fragment = document.createDocumentFragment();

      pageIndices.forEach(sectorIndex => {
        const sector = sectorList[sectorIndex];
        if (!sector) return;
        if (!Array.isArray(sector.maquinas)) sector.maquinas = [];

        const sectorMatches = Boolean(term) && String(sector.nome || '').toLowerCase().includes(term);
        const isOpen = Boolean(setoresVisiveis[sectorIndex]) || Boolean(term);
        const maxVisible = getVisibleCount(sectorIndex);

        let matchingAssets = [];
        if (isOpen) {
          matchingAssets = sector.maquinas
            .map((asset, assetIndex) => ({ asset, assetIndex }))
            .filter(({ asset }) => {
              if (!term || sectorMatches) return true;
              return [
                asset?.nome,
                asset?.tipo,
                asset?.etiqueta,
                asset?.usuarioResponsavel,
                asset?.fabricante,
                asset?.modelo
              ].some(value => String(value || '').toLowerCase().includes(term));
            });
        }

        const renderedAssets = isOpen ? matchingAssets.slice(0, maxVisible) : [];
        const remaining = Math.max(0, matchingAssets.length - renderedAssets.length);
        const maintenanceCount = sector.maquinas.reduce((total, asset) => total + (asset?.emManutencao ? 1 : 0), 0);

        const card = document.createElement('section');
        card.className = 'setor rrn-setor-card';
        card.dataset.setorIndex = String(sectorIndex);
        card.ondragover = event => event.preventDefault();
        card.ondrop = event => typeof dropMachine === 'function' && dropMachine(event, sectorIndex);

        const itemsHtml = renderedAssets.map(({ asset, assetIndex }) => {
          const statusClass = asset?.emManutencao ? 'maintenance' : 'online';
          const statusLabel = asset?.emManutencao ? 'Em manutenção' : 'Operando';
          const user = asset?.usuarioResponsavel
            ? `<span class="rrn-machine-user">👤 ${escapeHtml(asset.usuarioResponsavel)}</span>`
            : '';
          const tag = asset?.etiqueta
            ? `<span class="rrn-machine-tag">🏷️ ${escapeHtml(asset.etiqueta)}</span>`
            : '';

          return `
            <article class="rrn-machine-item ${statusClass}" draggable="${mayOperate ? 'true' : 'false'}"
              ${mayOperate ? `ondragstart="dragStart(event, ${sectorIndex}, ${assetIndex})"` : ''}>
              <div class="rrn-machine-icon" aria-hidden="true">${equipmentIcon(asset?.tipo)}</div>
              <div class="rrn-machine-main">
                <div class="rrn-machine-title-row">
                  <strong>${escapeHtml(asset?.nome || 'Equipamento sem nome')}</strong>
                  <span class="rrn-status ${statusClass}">${statusLabel}</span>
                </div>
                <div class="rrn-machine-meta">
                  <span>${escapeHtml(asset?.tipo || 'Equipamento')}</span>
                  ${tag}
                  ${user}
                </div>
              </div>
              <div class="rrn-machine-actions">
                <button type="button" class="rrn-btn rrn-btn-info" onclick="showInfo(${sectorIndex}, ${assetIndex})">Info</button>
                ${mayOperate ? `<button type="button" class="rrn-btn rrn-btn-danger operador-only" onclick="removeMaquina(${sectorIndex}, ${assetIndex})">Excluir</button>` : ''}
              </div>
            </article>`;
        }).join('');

        const emptyHtml = isOpen && matchingAssets.length === 0
          ? `<div class="rrn-sector-empty"><span>📦</span><div><strong>Este setor ainda está vazio</strong><small>${mayOperate ? 'Use “Adicionar equipamento” para começar.' : 'Nenhum equipamento cadastrado neste setor.'}</small></div></div>`
          : '';

        const loadMoreHtml = isOpen && remaining > 0
          ? `<div class="rrn-equipment-load-more">
               <span>Exibindo ${renderedAssets.length} de ${matchingAssets.length}</span>
               <button type="button" class="rrn-btn rrn-btn-secondary" onclick="rrnLoadMoreEquipment(${sectorIndex})">Carregar mais ${Math.min(PAGE_SIZE, remaining)}</button>
             </div>`
          : '';

        card.innerHTML = `
          <div class="setor-header rrn-setor-header">
            <div class="rrn-setor-title">
              <span class="rrn-setor-icon" aria-hidden="true">🏢</span>
              <div>
                <h2>${escapeHtml(sector.nome || 'Setor sem nome')}</h2>
                <div class="rrn-setor-summary">
                  <span>${sector.maquinas.length} ${sector.maquinas.length === 1 ? 'equipamento' : 'equipamentos'}</span>
                  ${maintenanceCount ? `<span class="rrn-maintenance-count">${maintenanceCount} em manutenção</span>` : '<span class="rrn-all-ok">Tudo operando</span>'}
                </div>
              </div>
            </div>
            ${mayOperate ? `<div class="rrn-setor-admin operador-only">
              <button type="button" class="rrn-icon-btn" onclick="editSetorName(${sectorIndex})" title="Renomear setor">✏️</button>
              <button type="button" class="rrn-icon-btn danger" onclick="removeSetor(${sectorIndex})" title="Excluir setor">🗑️</button>
            </div>` : ''}
          </div>
          <div class="rrn-setor-toolbar">
            ${mayOperate ? `<button type="button" class="rrn-btn rrn-btn-primary operador-only" onclick="abrirModalMaquina(${sectorIndex})">＋ Adicionar equipamento</button>` : ''}
            <button type="button" class="rrn-btn rrn-btn-secondary" onclick="toggleMachines(${sectorIndex})">
              ${isOpen ? 'Ocultar equipamentos' : `Mostrar equipamentos (${sector.maquinas.length})`}
            </button>
          </div>
          <div id="maquinas-${sectorIndex}" class="rrn-machines-list" style="display:${isOpen ? 'grid' : 'none'}">
            ${itemsHtml || emptyHtml}
            ${loadMoreHtml}
          </div>`;

        fragment.appendChild(card);
      });

      container.appendChild(fragment);
      if (typeof renderizarPaginacaoSetores === 'function') renderizarPaginacaoSetores(totalPages);
      window.RRN_UI?.updateOverview?.();
    };

    render.__rrnPagedEquipmentRenderer = true;
    window.renderSetores = render;

    const oldToggle = window.toggleMachines;
    window.toggleMachines = function toggleMachinesFast(sectorIndex) {
      const wasOpen = Boolean(setoresVisiveis?.[sectorIndex]);
      setoresVisiveis[sectorIndex] = !wasOpen;
      if (!wasOpen) resetVisibleCount(sectorIndex);
      render();
    };
    window.toggleMachines.__rrnPagedEquipmentToggle = true;
    window.toggleMachines.__rrnOriginal = oldToggle;

    window.rrnLoadMoreEquipment = function rrnLoadMoreEquipment(sectorIndex) {
      visibleBySector.set(sectorIndex, getVisibleCount(sectorIndex) + PAGE_SIZE);
      render();
    };

    if (!document.getElementById('rrn-equipment-performance-style')) {
      const style = document.createElement('style');
      style.id = 'rrn-equipment-performance-style';
      style.textContent = `
        .rrn-equipment-load-more {
          display:flex; align-items:center; justify-content:center; flex-wrap:wrap;
          gap:10px; padding:12px 8px 2px; color:rgba(41,89,145,.76); font-size:.72rem; font-weight:600;
        }
        .rrn-equipment-load-more .rrn-btn { min-width:150px; }
      `;
      document.head.appendChild(style);
    }

    return true;
  }

  function boot() {
    if (installRenderer()) {
      window.renderSetores?.();
      return;
    }
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (installRenderer()) {
        clearInterval(timer);
        window.renderSetores?.();
      } else if (attempts >= 20) {
        clearInterval(timer);
      }
    }, 150);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();