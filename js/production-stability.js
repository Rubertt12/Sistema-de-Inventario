(() => {
  'use strict';

  if (window.__RRN_PRODUCTION_STABILITY__) return;
  window.__RRN_PRODUCTION_STABILITY__ = true;

  let searchTimer = null;

  const normalize = value => String(value ?? '').trim().toLowerCase();

  function sectorList() {
    try {
      return Array.isArray(setores) ? setores : [];
    } catch {
      return [];
    }
  }

  function normalizeInventoryShape() {
    const list = sectorList();
    let changed = false;

    list.forEach((sector, sectorIndex) => {
      if (!sector || typeof sector !== 'object') {
        list[sectorIndex] = { nome: `Setor ${sectorIndex + 1}`, maquinas: [] };
        changed = true;
        return;
      }

      if (!Array.isArray(sector.maquinas)) {
        sector.maquinas = [];
        changed = true;
      }

      if (!String(sector.nome ?? '').trim()) {
        sector.nome = `Setor ${sectorIndex + 1}`;
        changed = true;
      }

      sector.maquinas = sector.maquinas.filter(Boolean).map((asset, assetIndex) => {
        if (asset && typeof asset === 'object') {
          if (!asset.id) {
            asset.id = crypto?.randomUUID?.() || `asset_${Date.now()}_${sectorIndex}_${assetIndex}`;
            changed = true;
          }
          if (!Array.isArray(asset.chamado) && Array.isArray(asset.chamados)) {
            asset.chamado = asset.chamados;
            changed = true;
          }
          if (!Array.isArray(asset.chamados) && Array.isArray(asset.chamado)) {
            asset.chamados = asset.chamado;
            changed = true;
          }
          if (!Array.isArray(asset.chamado) && !Array.isArray(asset.chamados)) {
            asset.chamado = [];
            asset.chamados = asset.chamado;
            changed = true;
          }
          return asset;
        }

        changed = true;
        return {
          id: crypto?.randomUUID?.() || `asset_${Date.now()}_${sectorIndex}_${assetIndex}`,
          nome: String(asset ?? 'Equipamento'),
          tipo: 'Equipamento',
          etiqueta: '',
          chamado: [],
          chamados: [],
          emManutencao: false,
          tempoManutencao: 0
        };
      });
    });

    try {
      if (typeof setoresVisiveis !== 'undefined' && Array.isArray(setoresVisiveis)) {
        while (setoresVisiveis.length < list.length) setoresVisiveis.push(false);
        if (setoresVisiveis.length > list.length) setoresVisiveis.splice(list.length);
      }
    } catch {}

    if (changed) {
      try {
        if (typeof saveSetoresAndMachines === 'function') saveSetoresAndMachines();
        else localStorage.setItem('setores', JSON.stringify(list));
      } catch (error) {
        console.warn('RRN Manager: não foi possível normalizar dados legados.', error);
      }
    }
  }

  function assetMatches(asset, term) {
    return [
      asset?.nome,
      asset?.numeroSerie,
      asset?.tipo,
      asset?.etiqueta,
      asset?.usuarioResponsavel,
      asset?.fabricante,
      asset?.modelo,
      asset?.localizacao,
      asset?.situacaoPatrimonial,
      asset?.observacoesAtivo
    ].some(value => normalize(value).includes(term));
  }

  function runSearch() {
    const input = document.getElementById('searchInput');
    if (!input) return;

    const term = normalize(input.value);
    const list = sectorList();

    try {
      paginaSetoresAtual = 1;
      setoresFiltradosIndices = term
        ? list.reduce((indices, sector, index) => {
            const sectorNameMatches = normalize(sector?.nome).includes(term);
            const machines = Array.isArray(sector?.maquinas) ? sector.maquinas : [];
            if (sectorNameMatches || machines.some(asset => assetMatches(asset, term))) indices.push(index);
            return indices;
          }, [])
        : null;
    } catch (error) {
      console.warn('RRN Manager: falha ao aplicar filtro.', error);
      return;
    }

    try {
      if (typeof renderSetores === 'function') renderSetores(term || null);
    } catch (error) {
      console.error('RRN Manager: falha ao renderizar resultado da pesquisa.', error);
    }
  }

  function filterMachinesStable() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(runSearch, 160);
  }

  function bindSearch() {
    const input = document.getElementById('searchInput');
    if (!input || input.dataset.rrnStableSearch === '1') return;
    input.dataset.rrnStableSearch = '1';

    // O HTML legado chama filterMachines no keyup. O listener input cobre
    // colagem, autocomplete e o botão nativo de limpar do input search.
    input.addEventListener('input', filterMachinesStable);
    input.addEventListener('search', filterMachinesStable);
    input.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      if (!input.value) return;
      event.preventDefault();
      input.value = '';
      runSearch();
      input.blur();
    });
  }

  function patchDropState() {
    const current = window.dropMachine;
    if (typeof current !== 'function' || current.__rrnDropStable) return;

    const wrapped = function(event, targetSectorIndex) {
      try {
        if (typeof maquinaEmMovimento !== 'undefined' && maquinaEmMovimento?.setorIndex === targetSectorIndex) {
          event?.preventDefault?.();
          maquinaEmMovimento = null;
          return;
        }
      } catch {}
      return current.apply(this, arguments);
    };
    wrapped.__rrnDropStable = true;
    wrapped.__rrnOriginal = current;
    window.dropMachine = wrapped;
  }

  function boot() {
    normalizeInventoryShape();
    window.filterMachines = filterMachinesStable;
    bindSearch();
    patchDropState();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.addEventListener('load', () => {
    boot();
    setTimeout(boot, 120);
  });
})();