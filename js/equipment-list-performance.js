(() => {
  'use strict';

  if (window.__RRN_SECTOR_EQUIPMENT_CATEGORIES_V2__) return;
  window.__RRN_SECTOR_EQUIPMENT_CATEGORIES_V2__ = true;
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
    const explicit = normalize(asset?.tipo);
    if (explicit) {
      if (explicit.includes('monitor')) return 'monitors';
      if (explicit.includes('impress') || explicit.includes('printer')) return 'printers';
      if (explicit.includes('notebook') || explicit.includes('laptop')) return 'notebooks';
      if (explicit.includes('workstation')) return 'workstations';
      if (explicit.includes('desktop')) return 'desktops';
      if (explicit.includes('computador') || explicit.includes('maquina') || /(^|\s)pc(\s|$)/.test(explicit)) return 'computers';
    }

    const fallback = normalize([
      asset?.tipoMaquina,
      asset?.categoria,
      asset?.nome
    ].filter(Boolean).join(' '));

    if (fallback.includes('monitor')) return 'monitors';
    if (fallback.includes('impress') || fallback.includes('printer')) return 'printers';
    if (fallback.includes('notebook') || fallback.includes('laptop')) return 'notebooks';
    if (fallback.includes('workstation')) return 'workstations';
    if (fallback.includes('desktop')) return 'desktops';
    if (fallback.includes('computador') || fallback.includes('maquina') || /(^|\s)pc(\s|$)/.test(fallback)) return 'computers';
    return 'others';
  }

  const categoryLabels = {
    notebooks: 'Notebooks',
    desktops: 'Desktops',
    workstations: 'Workstations',
    computers: 'Computadores',
    monitors: 'Monitores',
    printers: 'Impressoras',
    others: 'Outros',
    all: 'Todos'
  };

  function categoryCounts(assets) {
    const counts = {
      notebooks: 0,
      desktops: 0,
      workstations: 0,
      computers: 0,
      monitors: 0,
      printers: 0,
      others: 0
    };
    assets.forEach(asset => { counts[categoryFor(asset)] += 1; });
    return counts;
  }

  function equipmentIcon(type) {
    const value = normalize(type);
    if (value.includes('monitor')) return 'monitor';
    if (value.includes('impress') || value.includes('printer')) return 'printer';
    if (value.includes('notebook') || value.includes('laptop')) return 'laptop';
    if (value.includes('workstation')) return 'workstation';
    return 'monitor';
  }

  function getVisibleCount(sectorIndex) {
    return visibleBySector.get(sectorIndex) || PAGE_SIZE;
  }

  function resetVisibleCount(sectorIndex) {
    visibleBySector.set(sectorIndex, PAGE_SIZE);
  }

  function keepOpen(sectorIndex) {
    const index = Number(sectorIndex);
    try {
      if (typeof setoresVisiveis !== 'undefined' && Array.isArray(setoresVisiveis)) {
        setoresVisiveis[index] = true;
      }
    } catch {}
  }

  function chooserHtml(sectorIndex, assets) {
    const counts = categoryCounts(assets);
    const options = [
      ['notebooks', counts.notebooks],
      ['desktops', counts.desktops],
      ['workstations', counts.workstations],
      ['computers', counts.computers],
      ['monitors', counts.monitors],
      ['printers', counts.printers],
      ['others', counts.others],
      ['all', assets.length]
    ].filter(([, count]) => count > 0);

    return `
      <div class="rrn-sector-category-shell" data-sector-category-shell="${sectorIndex}">
        <div class="rrn-sector-category-copy">
          <strong>Tipo de equipamento</strong>
          <small>Escolha uma categoria para visualizar os itens deste setor.</small>
        </div>
        <div class="rrn-sector-categories" role="tablist" aria-label="Tipos de equipamento do setor">
          ${options.map(([key, count]) => `
            <button type="button" class="rrn-sector-category" data-category="${key}" data-sector-index="${sectorIndex}" role="tab" aria-selected="false">
              <span>${escapeHtml(categoryLabels[key])}</span><strong>${count}</strong>
            </button>`).join('')}
        </div>
      </div>`;
  }

  function backBarHtml(sectorIndex, selected) {
    return `
      <div class="rrn-category-backbar">
        <div class="rrn-category-current">
          <small>Visualizando categoria</small>
          <strong>${escapeHtml(categoryLabels[selected] || 'Equipamentos')}</strong>
        </div>
        <button type="button" class="rrn-btn rrn-btn-secondary rrn-category-back-btn" data-sector-index="${sectorIndex}">
          <span aria-hidden="true">←</span>
          Voltar para categorias
        </button>
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
        <article class="rrn-machine-item ${statusClass}" draggable="${mayOperate ? 'true' : 'false'}" data-asset-index="${assetIndex}" ${mayOperate ? `ondragstart="dragStart(event, ${sectorIndex}, ${assetIndex})"` : ''}>
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

  function renderSetoresCategorized(termoBusca = null) {
    const container = document.getElementById('setoresContainer');
    if (!container) return;

    let sectorList = [];
    try { sectorList = Array.isArray(setores) ? setores : []; } catch { sectorList = []; }

    const term = normalize(termoBusca || document.getElementById('searchInput')?.value || '');
    const searching = Boolean(term);
    const baseIndices = (() => {
      try {
        return setoresFiltradosIndices != null
          ? setoresFiltradosIndices
          : sectorList.map((_, index) => index);
      } catch {
        return sectorList.map((_, index) => index);
      }
    })();

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
      container.innerHTML = `<div class="rrn-empty-state"><strong>Nenhum setor ou equipamento encontrado</strong><small>Tente outro termo de pesquisa ou crie um novo setor.</small></div>`;
      document.getElementById('setoresPaginacao')?.remove();
      window.RRN_UI?.updateOverview?.();
      return;
    }

    let currentPage = 1;
    let perPage = 10;
    try {
      currentPage = typeof paginaSetoresAtual === 'number' ? paginaSetoresAtual : 1;
      perPage = typeof setoresPorPagina === 'number' && setoresPorPagina > 0 ? setoresPorPagina : 10;
    } catch {}

    const totalPages = Math.max(1, Math.ceil(visibleIndices.length / perPage));
    currentPage = Math.min(Math.max(currentPage, 1), totalPages);
    try { paginaSetoresAtual = currentPage; } catch {}

    const start = (currentPage - 1) * perPage;
    const pageIndices = visibleIndices.slice(start, start + perPage);
    const mayOperate = canOperate();
    const fragment = document.createDocumentFragment();

    pageIndices.forEach(sectorIndex => {
      const sector = sectorList[sectorIndex];
      if (!sector) return;
      if (!Array.isArray(sector.maquinas)) sector.maquinas = [];

      let isOpen = searching;
      try { isOpen = searching || Boolean(setoresVisiveis?.[sectorIndex]); } catch {}
      const selected = searching ? 'search' : (selectedBySector.get(sectorIndex) || null);
      const maxVisible = getVisibleCount(sectorIndex);

      let matchingAssets = [];
      if (isOpen) {
        if (searching) {
          const sectorMatches = normalize(sector.nome).includes(term);
          matchingAssets = sector.maquinas
            .map((asset, assetIndex) => ({ asset, assetIndex }))
            .filter(({ asset }) => sectorMatches || [
              asset?.nome,
              asset?.tipo,
              asset?.etiqueta,
              asset?.usuarioResponsavel,
              asset?.fabricante,
              asset?.modelo
            ].some(value => normalize(value).includes(term)));
        } else if (selected) {
          matchingAssets = sector.maquinas
            .map((asset, assetIndex) => ({ asset, assetIndex }))
            .filter(({ asset }) => selected === 'all' || categoryFor(asset) === selected);
        }
      }

      const renderedAssets = matchingAssets.slice(0, maxVisible);
      const remaining = Math.max(0, matchingAssets.length - renderedAssets.length);
      const maintenanceCount = sector.maquinas.reduce((total, asset) => total + (asset?.emManutencao ? 1 : 0), 0);

      let categoryHtml = '';
      if (isOpen && !searching && sector.maquinas.length) {
        categoryHtml = selected ? backBarHtml(sectorIndex, selected) : chooserHtml(sectorIndex, sector.maquinas);
      }

      let listHtml = '';
      if (isOpen && searching) {
        listHtml = renderItems(sectorIndex, renderedAssets, mayOperate) || `<div class="rrn-category-empty"><strong>Nenhum equipamento encontrado</strong><small>Tente outro termo de pesquisa.</small></div>`;
      } else if (isOpen && !sector.maquinas.length) {
        listHtml = `<div class="rrn-sector-empty"><div><strong>Este setor ainda está vazio</strong><small>${mayOperate ? 'Use “Adicionar equipamento” para começar.' : 'Nenhum equipamento cadastrado neste setor.'}</small></div></div>`;
      } else if (isOpen && selected) {
        listHtml = renderItems(sectorIndex, renderedAssets, mayOperate) || `<div class="rrn-category-empty"><strong>Nenhum equipamento nesta categoria</strong><small>Volte para categorias e escolha outro tipo de equipamento.</small></div>`;
      } else if (isOpen) {
        listHtml = `<div class="rrn-category-empty"><strong>Selecione uma categoria acima</strong><small>Os equipamentos aparecem somente depois que você escolher uma categoria.</small></div>`;
      }

      const loadMoreHtml = isOpen && selected && remaining > 0
        ? `<div class="rrn-equipment-load-more"><span>Exibindo ${renderedAssets.length} de ${matchingAssets.length}</span><button type="button" class="rrn-btn rrn-btn-secondary" data-rrn-load-more="${sectorIndex}">Carregar mais ${Math.min(PAGE_SIZE, remaining)}</button></div>`
        : '';

      const card = document.createElement('section');
      card.className = 'setor rrn-setor-card';
      card.dataset.setorIndex = String(sectorIndex);
      card.ondragover = event => event.preventDefault();
      card.ondrop = event => typeof dropMachine === 'function' && dropMachine(event, sectorIndex);
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
          ${mayOperate ? `<div class="rrn-setor-admin operador-only"><button type="button" class="rrn-icon-btn" onclick="editSetorName(${sectorIndex})" title="Renomear setor" data-rrn-icon="edit"></button><button type="button" class="rrn-icon-btn danger" onclick="removeSetor(${sectorIndex})" title="Excluir setor" data-rrn-icon="trash"></button></div>` : ''}
        </div>
        <div class="rrn-setor-toolbar">
          ${mayOperate ? `<button type="button" class="rrn-btn rrn-btn-primary operador-only" onclick="abrirModalMaquina(${sectorIndex})" data-rrn-icon="plus">Adicionar equipamento</button>` : ''}
          <button type="button" class="rrn-btn rrn-btn-secondary" data-rrn-toggle-sector="${sectorIndex}">${isOpen && !searching ? 'Ocultar equipamentos' : `Mostrar equipamentos (${sector.maquinas.length})`}</button>
        </div>
        ${categoryHtml}
        <div id="maquinas-${sectorIndex}" class="rrn-machines-list" style="display:${isOpen ? 'grid' : 'none'}">${listHtml}${loadMoreHtml}</div>`;

      fragment.appendChild(card);
    });

    container.appendChild(fragment);
    try { if (typeof renderizarPaginacaoSetores === 'function') renderizarPaginacaoSetores(totalPages); } catch {}
    window.RRN_UI?.updateOverview?.();
    window.RRN_ICONS?.decorateStatic?.(container);
    window.RRN_GRID_DETAILS?.enhanceAll?.(container);
    window.RRN_COMPACT_ACTIONS?.enhance?.(container);
    window.RRN_USER_ASSETS?.refreshCards?.(container);
  }

  function select(sectorIndex, category) {
    const index = Number(sectorIndex);
    if (!Number.isInteger(index)) return;
    keepOpen(index);
    selectedBySector.set(index, category);
    resetVisibleCount(index);
    renderSetoresCategorized();
  }

  function back(sectorIndex) {
    const index = Number(sectorIndex);
    if (!Number.isInteger(index)) return;
    keepOpen(index);
    selectedBySector.delete(index);
    resetVisibleCount(index);
    renderSetoresCategorized();
  }

  function toggle(sectorIndex) {
    const index = Number(sectorIndex);
    if (!Number.isInteger(index)) return;
    let wasOpen = false;
    try { wasOpen = Boolean(setoresVisiveis?.[index]); } catch {}
    try { setoresVisiveis[index] = !wasOpen; } catch {}
    if (!wasOpen) {
      selectedBySector.delete(index);
      resetVisibleCount(index);
    }
    renderSetoresCategorized();
  }

  function loadMore(sectorIndex) {
    const index = Number(sectorIndex);
    visibleBySector.set(index, getVisibleCount(index) + PAGE_SIZE);
    renderSetoresCategorized();
  }

  function bindInteractions() {
    if (document.documentElement.dataset.rrnCategoryInteractionsV2 === '1') return;
    document.documentElement.dataset.rrnCategoryInteractionsV2 = '1';

    document.addEventListener('click', event => {
      const categoryButton = event.target.closest?.('.rrn-sector-category[data-category]');
      if (categoryButton) {
        event.preventDefault();
        event.stopPropagation();
        select(Number(categoryButton.dataset.sectorIndex), categoryButton.dataset.category);
        return;
      }

      const backButton = event.target.closest?.('.rrn-category-back-btn[data-sector-index]');
      if (backButton) {
        event.preventDefault();
        event.stopPropagation();
        back(Number(backButton.dataset.sectorIndex));
        return;
      }

      const toggleButton = event.target.closest?.('[data-rrn-toggle-sector]');
      if (toggleButton) {
        event.preventDefault();
        event.stopPropagation();
        toggle(Number(toggleButton.dataset.rrnToggleSector));
        return;
      }

      const loadMoreButton = event.target.closest?.('[data-rrn-load-more]');
      if (loadMoreButton) {
        event.preventDefault();
        event.stopPropagation();
        loadMore(Number(loadMoreButton.dataset.rrnLoadMore));
      }
    }, true);
  }

  function injectStyles() {
    if (document.getElementById('rrn-sector-category-styles-v2')) return;
    const style = document.createElement('style');
    style.id = 'rrn-sector-category-styles-v2';
    style.textContent = `
      .rrn-equipment-load-more{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:10px;padding:12px 8px 2px;color:rgba(41,89,145,.76);font-size:.72rem;font-weight:600}
      .rrn-sector-category-shell{margin:12px 0 4px;padding:12px;border:1px solid rgba(41,89,145,.12);border-radius:12px;background:rgba(255,255,255,.55)}
      .rrn-sector-category-copy{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:9px}
      .rrn-sector-category-copy strong{color:var(--rrn-blue,#295991);font-size:.72rem}.rrn-sector-category-copy small{color:#768194;font-size:.61rem}
      .rrn-sector-categories{display:flex;flex-wrap:wrap;gap:7px}
      .rrn-sector-category{display:inline-flex;align-items:center;justify-content:space-between;gap:9px;min-height:35px;padding:7px 10px;border:1px solid rgba(41,89,145,.16);border-radius:9px;background:#fff;color:#40516a;font:inherit;font-size:.67rem;font-weight:750;cursor:pointer;transition:.16s ease}
      .rrn-sector-category:hover{border-color:rgba(41,89,145,.34);background:rgba(41,89,145,.045)}
      .rrn-sector-category strong{display:grid;min-width:21px;height:21px;place-items:center;padding:0 5px;border-radius:999px;background:rgba(41,89,145,.08);color:var(--rrn-blue,#295991);font-size:.59rem}
      .rrn-category-backbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:12px 0 4px;padding:10px 12px;border:1px solid rgba(41,89,145,.14);border-radius:11px;background:rgba(41,89,145,.045)}
      .rrn-category-current{display:flex;align-items:baseline;gap:7px;min-width:0}.rrn-category-current small{color:#768194;font-size:.61rem;font-weight:650}.rrn-category-current strong{color:var(--rrn-blue,#295991);font-size:.72rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .rrn-category-back-btn{display:inline-flex!important;align-items:center;gap:6px;flex:0 0 auto;visibility:visible!important;opacity:1!important}
      .rrn-category-empty{grid-column:1/-1;padding:24px 16px;border:1px dashed rgba(41,89,145,.18);border-radius:12px;text-align:center;background:rgba(255,255,255,.36)}
      .rrn-category-empty strong,.rrn-category-empty small{display:block}.rrn-category-empty strong{color:var(--rrn-blue,#295991);font-size:.75rem}.rrn-category-empty small{margin-top:4px;color:#768194;font-size:.64rem}
      @media(max-width:620px){.rrn-sector-category-copy{display:block}.rrn-sector-category-copy small{display:block;margin-top:3px}.rrn-sector-categories{display:grid;grid-template-columns:1fr 1fr}.rrn-sector-category{width:100%}.rrn-category-backbar{align-items:stretch;flex-direction:column}.rrn-category-back-btn{justify-content:center;width:100%}}
      @media(max-width:390px){.rrn-sector-categories{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function install() {
    injectStyles();
    bindInteractions();
    window.renderSetores = renderSetoresCategorized;
    window.toggleMachines = toggle;
    window.rrnLoadMoreEquipment = loadMore;
    window.RRN_SECTOR_CATEGORIES = Object.freeze({ select, back, loadMore, categoryFor });
    renderSetoresCategorized();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
