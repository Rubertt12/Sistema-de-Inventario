(() => {
  'use strict';

  if (window.__RRN_SECTOR_EQUIPMENT_CATEGORIES__) return;
  window.__RRN_SECTOR_EQUIPMENT_CATEGORIES__ = true;

  const PAGE_SIZE = 32;
  const selectedBySector = new Map();
  const visibleBySector = new Map();

  const clean = value => String(value ?? '').trim();
  const normalize = value => clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
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

  function categoryFor(asset) {
    const haystack = normalize([
      asset?.tipo,
      asset?.tipoMaquina,
      asset?.nome,
      asset?.categoria
    ].filter(Boolean).join(' '));

    if (haystack.includes('monitor')) return 'monitors';
    if (haystack.includes('impress') || haystack.includes('printer')) return 'printers';
    if (
      haystack.includes('notebook') ||
      haystack.includes('desktop') ||
      haystack.includes('computador') ||
      haystack.includes('workstation') ||
      haystack.includes('maquina') ||
      /(^|\s)pc(\s|$)/.test(haystack)
    ) return 'computers';

    return 'others';
  }

  function categoryCounts(assets) {
    const counts = { computers: 0, monitors: 0, printers: 0, others: 0 };
    assets.forEach(asset => { counts[categoryFor(asset)] += 1; });
    return counts;
  }

  function equipmentIcon(type) {
    const value = normalize(type);
    if (value.includes('monitor')) return 'monitor';
    if (value.includes('impress') || value.includes('printer')) return 'printer';
    if (value.includes('notebook')) return 'laptop';
    return 'monitor';
  }

  function getVisibleCount(sectorIndex) {
    return visibleBySector.get(sectorIndex) || PAGE_SIZE;
  }

  function resetVisibleCount(sectorIndex) {
    visibleBySector.set(sectorIndex, PAGE_SIZE);
  }

  function categoryButtons(sectorIndex, assets, selected, searching) {
    if (!assets.length || searching) return '';

    const counts = categoryCounts(assets);
    const options = [
      ['computers', 'Computadores', counts.computers],
      ['monitors', 'Monitores', counts.monitors],
      ['printers', 'Impressoras', counts.printers],
      ['others', 'Outros', counts.others],
      ['all', 'Todos', assets.length]
    ].filter(([, , count]) => count > 0);

    return `
      <div class="rrn-sector-category-shell" data-sector-category-shell="${sectorIndex}">
        <div class="rrn-sector-category-copy">
          <strong>Tipo de equipamento</strong>
          <small>Escolha uma categoria para visualizar os itens deste setor.</small>
        </div>
        <div class="rrn-sector-categories" role="tablist" aria-label="Tipos de equipamento do setor">
          ${options.map(([key, label, count]) => `
            <button type="button"
              class="rrn-sector-category${selected === key ? ' is-active' : ''}"
              data-category="${key}"
              role="tab"
              aria-selected="${selected === key ? 'true' : 'false'}"
              onclick="RRN_SECTOR_CATEGORIES.select(${sectorIndex}, '${key}')">
              <span>${label}</span><strong>${count}</strong>
            </button>`).join('')}
        </div>
      </div>`;
  }

  function renderItems(sectorIndex, entries, mayOperate) {
    return entries.map(({ asset, assetIndex }) => {
      const statusClass = asset?.emManutencao ? 'maintenance' : 'online';
      const statusLabel = asset?.emManutencao ? 'Em manutenção' : 'Operando';
      const user = asset?.usuarioResponsavel
        ? `<span class="rrn-machine-user">${escapeHtml(asset.usuarioResponsavel)}</span>`
        : '';
      const tag = asset?.etiqueta
        ? `<span class="rrn-machine-tag">${escapeHtml(asset.etiqueta)}</span>`
        : '';

      return `
        <article class="rrn-machine-item ${statusClass}" draggable="${mayOperate ? 'true' : 'false'}"
          data-asset-index="${assetIndex}"
          ${mayOperate ? `ondragstart="dragStart(event, ${sectorIndex}, ${assetIndex})"` : ''}>
          <div class="rrn-machine-icon" aria-hidden="true" data-rrn-icon="${equipmentIcon(asset?.tipo)}"></div>
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
  }

  function installRenderer() {
    try {
      if (typeof setores === 'undefined' || typeof setoresVisiveis === 'undefined') return false;
    } catch {
      return false;
    }

    const render = function renderSetoresCategorized(termoBusca = null) {
      const container = document.getElementById('setoresContainer');
      if (!container) return;

      const term = normalize(termoBusca || document.getElementById('searchInput')?.value || '');
      const searching = Boolean(term);
      const sectorList = Array.isArray(setores) ? setores : [];
      const baseIndices = (typeof setoresFiltradosIndices !== 'undefined' && setoresFiltradosIndices != null)
        ? setoresFiltradosIndices
        : sectorList.map((_, index) => index);

      const visibleIndices = baseIndices.filter(index => {
        const sector = sectorList[index];
        if (!sector) return false;
        if (!term) return true;
        if (normalize(sector.nome).includes(term)) return true;
        return (Array.isArray(sector.maquinas) ? sector.maquinas : []).some(asset => [
          asset?.nome,
          asset?.tipo,
          asset?.etiqueta,
          asset?.usuarioResponsavel,
          asset?.fabricante,
          asset?.modelo
        ].some(value => normalize(value).includes(term)));
      });

      container.replaceChildren();

      if (!visibleIndices.length) {
        container.innerHTML = `
          <div class="rrn-empty-state">
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

        const sectorMatches = searching && normalize(sector.nome).includes(term);
        const isOpen = Boolean(setoresVisiveis[sectorIndex]) || searching;
        const selected = searching ? 'search' : (selectedBySector.get(sectorIndex) || null);
        const maxVisible = getVisibleCount(sectorIndex);

        let matchingAssets = [];
        if (isOpen) {
          matchingAssets = sector.maquinas
            .map((asset, assetIndex) => ({ asset, assetIndex }))
            .filter(({ asset }) => {
              if (searching) {
                if (sectorMatches) return true;
                return [
                  asset?.nome,
                  asset?.tipo,
                  asset?.etiqueta,
                  asset?.usuarioResponsavel,
                  asset?.fabricante,
                  asset?.modelo
                ].some(value => normalize(value).includes(term));
              }
              if (!selected) return false;
              if (selected === 'all') return true;
              return categoryFor(asset) === selected;
            });
        }

        const renderedAssets = matchingAssets.slice(0, maxVisible);
        const remaining = Math.max(0, matchingAssets.length - renderedAssets.length);
        const maintenanceCount = sector.maquinas.reduce((total, asset) => total + (asset?.emManutencao ? 1 : 0), 0);
        const card = document.createElement('section');
        card.className = 'setor rrn-setor-card';
        card.dataset.setorIndex = String(sectorIndex);
        card.ondragover = event => event.preventDefault();
        card.ondrop = event => typeof dropMachine === 'function' && dropMachine(event, sectorIndex);

        const categoryHtml = isOpen ? categoryButtons(sectorIndex, sector.maquinas, selected, searching) : '';
        const itemsHtml = renderItems(sectorIndex, renderedAssets, mayOperate);

        let emptyHtml = '';
        if (isOpen && !searching && sector.maquinas.length === 0) {
          emptyHtml = `<div class="rrn-sector-empty"><div><strong>Este setor ainda está vazio</strong><small>${mayOperate ? 'Use “Adicionar equipamento” para começar.' : 'Nenhum equipamento cadastrado neste setor.'}</small></div></div>`;
        } else if (isOpen && !searching && sector.maquinas.length > 0 && !selected) {
          emptyHtml = `<div class="rrn-category-empty"><strong>Selecione uma categoria acima</strong><small>Os equipamentos só serão exibidos depois que você escolher o tipo.</small></div>`;
        } else if (isOpen && matchingAssets.length === 0) {
          emptyHtml = `<div class="rrn-category-empty"><strong>Nenhum equipamento nesta categoria</strong><small>Escolha outro tipo de equipamento.</small></div>`;
        }

        const loadMoreHtml = isOpen && remaining > 0
          ? `<div class="rrn-equipment-load-more">
               <span>Exibindo ${renderedAssets.length} de ${matchingAssets.length}</span>
               <button type="button" class="rrn-btn rrn-btn-secondary" onclick="RRN_SECTOR_CATEGORIES.loadMore(${sectorIndex})">Carregar mais ${Math.min(PAGE_SIZE, remaining)}</button>
             </div>`
          : '';

        card.innerHTML = `
          <div class="setor-header rrn-setor-header">
            <div class="rrn-setor-title">
              <span class="rrn-setor-icon" aria-hidden="true" data-rrn-icon="building"></span>
              <div>
                <h2>${escapeHtml(sector.nome || 'Setor sem nome')}</h2>
                <div class="rrn-setor-summary">
                  <span>${sector.maquinas.length} ${sector.maquinas.length === 1 ? 'equipamento' : 'equipamentos'}</span>
                  ${maintenanceCount ? `<span class="rrn-maintenance-count">${maintenanceCount} em manutenção</span>` : '<span class="rrn-all-ok">Tudo operando</span>'}
                </div>
              </div>
            </div>
            ${mayOperate ? `<div class="rrn-setor-admin operador-only">
              <button type="button" class="rrn-icon-btn" onclick="editSetorName(${sectorIndex})" title="Renomear setor" data-rrn-icon="edit"></button>
              <button type="button" class="rrn-icon-btn danger" onclick="removeSetor(${sectorIndex})" title="Excluir setor" data-rrn-icon="trash"></button>
            </div>` : ''}
          </div>
          <div class="rrn-setor-toolbar">
            ${mayOperate ? `<button type="button" class="rrn-btn rrn-btn-primary operador-only" onclick="abrirModalMaquina(${sectorIndex})" data-rrn-icon="plus">Adicionar equipamento</button>` : ''}
            <button type="button" class="rrn-btn rrn-btn-secondary" onclick="toggleMachines(${sectorIndex})">
              ${isOpen && !searching ? 'Ocultar equipamentos' : `Mostrar equipamentos (${sector.maquinas.length})`}
            </button>
          </div>
          ${categoryHtml}
          <div id="maquinas-${sectorIndex}" class="rrn-machines-list" style="display:${isOpen ? 'grid' : 'none'}">
            ${itemsHtml || emptyHtml}
            ${loadMoreHtml}
          </div>`;

        fragment.appendChild(card);
      });

      container.appendChild(fragment);
      if (typeof renderizarPaginacaoSetores === 'function') renderizarPaginacaoSetores(totalPages);
      window.RRN_UI?.updateOverview?.();
      window.RRN_ICONS?.decorateStatic?.(container);
      window.RRN_GRID_DETAILS?.enhanceAll?.();
      window.RRN_COMPACT_ACTIONS?.enhance?.(container);
      window.RRN_USER_ASSETS?.refreshCards?.();
    };

    render.__rrnSectorCategoryRenderer = true;
    window.renderSetores = render;

    window.toggleMachines = function toggleMachinesCategorized(sectorIndex) {
      const wasOpen = Boolean(setoresVisiveis?.[sectorIndex]);
      setoresVisiveis[sectorIndex] = !wasOpen;
      if (!wasOpen) {
        selectedBySector.delete(sectorIndex);
        resetVisibleCount(sectorIndex);
      }
      render();
    };

    window.rrnLoadMoreEquipment = function rrnLoadMoreEquipmentCompat(sectorIndex) {
      visibleBySector.set(sectorIndex, getVisibleCount(sectorIndex) + PAGE_SIZE);
      render();
    };

    return true;
  }

  function injectStyles() {
    if (document.getElementById('rrn-sector-category-styles')) return;
    const style = document.createElement('style');
    style.id = 'rrn-sector-category-styles';
    style.textContent = `
      .rrn-equipment-load-more{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:10px;padding:12px 8px 2px;color:rgba(41,89,145,.76);font-size:.72rem;font-weight:600}
      .rrn-equipment-load-more .rrn-btn{min-width:150px}
      .rrn-sector-category-shell{margin:12px 0 4px;padding:12px;border:1px solid rgba(41,89,145,.12);border-radius:12px;background:rgba(255,255,255,.55)}
      .rrn-sector-category-copy{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:9px}
      .rrn-sector-category-copy strong{color:var(--rrn-blue,#295991);font-size:.72rem}.rrn-sector-category-copy small{color:#768194;font-size:.61rem}
      .rrn-sector-categories{display:flex;flex-wrap:wrap;gap:7px}
      .rrn-sector-category{display:inline-flex;align-items:center;justify-content:space-between;gap:9px;min-height:35px;padding:7px 10px;border:1px solid rgba(41,89,145,.16);border-radius:9px;background:#fff;color:#40516a;font:inherit;font-size:.67rem;font-weight:750;cursor:pointer;transition:.16s ease}
      .rrn-sector-category:hover{border-color:rgba(41,89,145,.34);background:rgba(41,89,145,.045)}
      .rrn-sector-category strong{display:grid;min-width:21px;height:21px;place-items:center;padding:0 5px;border-radius:999px;background:rgba(41,89,145,.08);color:var(--rrn-blue,#295991);font-size:.59rem}
      .rrn-sector-category.is-active{border-color:var(--rrn-blue,#295991);background:rgba(41,89,145,.08);color:var(--rrn-blue,#295991)}
      .rrn-category-empty{grid-column:1/-1;padding:24px 16px;border:1px dashed rgba(41,89,145,.18);border-radius:12px;text-align:center;background:rgba(255,255,255,.36)}
      .rrn-category-empty strong,.rrn-category-empty small{display:block}.rrn-category-empty strong{color:var(--rrn-blue,#295991);font-size:.75rem}.rrn-category-empty small{margin-top:4px;color:#768194;font-size:.64rem}
      @media(max-width:620px){.rrn-sector-category-copy{display:block}.rrn-sector-category-copy small{display:block;margin-top:3px}.rrn-sector-categories{display:grid;grid-template-columns:1fr 1fr}.rrn-sector-category{width:100%}}
      @media(max-width:390px){.rrn-sector-categories{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function select(sectorIndex, category) {
    selectedBySector.set(Number(sectorIndex), category);
    resetVisibleCount(Number(sectorIndex));
    window.renderSetores?.();
  }

  function loadMore(sectorIndex) {
    const index = Number(sectorIndex);
    visibleBySector.set(index, getVisibleCount(index) + PAGE_SIZE);
    window.renderSetores?.();
  }

  function boot() {
    injectStyles();
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

  window.RRN_SECTOR_CATEGORIES = Object.freeze({ select, loadMore, categoryFor });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
