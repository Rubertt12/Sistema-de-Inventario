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

  function normalizeTicket(raw) {
    const ticket = raw && typeof raw === 'object' ? raw : { texto: String(raw ?? '') };
    const text = String(ticket.texto || ticket.descricao || ticket.observacao || '').trim();
    ticket.texto = text;
    ticket.descricao = ticket.descricao || text;
    ticket.prioridade = ticket.prioridade || 'Baixa';
    ticket.data = ticket.data || new Date().toISOString();
    if (!Array.isArray(ticket.interacoes)) ticket.interacoes = [];
    return ticket;
  }

  function reconcileTickets(asset) {
    const legacy = Array.isArray(asset.chamado) ? asset.chamado : [];
    const modern = Array.isArray(asset.chamados) ? asset.chamados : [];
    const seen = new Set();
    const merged = [];

    [...modern, ...legacy].forEach(raw => {
      const ticket = normalizeTicket(raw);
      const key = [ticket.data, ticket.prioridade, ticket.texto].join('|');
      if (seen.has(key)) return;
      seen.add(key);
      merged.push(ticket);
    });

    const beforeLegacy = JSON.stringify(legacy);
    const beforeModern = JSON.stringify(modern);
    asset.chamado = merged;
    asset.chamados = merged;
    return beforeLegacy !== JSON.stringify(merged) || beforeModern !== JSON.stringify(merged);
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
          if (reconcileTickets(asset)) changed = true;
          if (typeof asset.emManutencao !== 'boolean') {
            asset.emManutencao = Boolean(asset.emManutencao);
            changed = true;
          }
          if (!Number.isFinite(Number(asset.tempoManutencao))) {
            asset.tempoManutencao = 0;
            changed = true;
          }
          return asset;
        }

        changed = true;
        const calls = [];
        return {
          id: crypto?.randomUUID?.() || `asset_${Date.now()}_${sectorIndex}_${assetIndex}`,
          nome: String(asset ?? 'Equipamento'),
          tipo: 'Equipamento',
          etiqueta: '',
          chamado: calls,
          chamados: calls,
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

  function activeSearchTerm() {
    return normalize(document.getElementById('searchInput')?.value || '');
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

    input.addEventListener('input', filterMachinesStable);
    input.addEventListener('search', filterMachinesStable);
    input.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || !input.value) return;
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

  function patchEquipmentNavigation() {
    const toggle = window.toggleMachines;
    if (typeof toggle === 'function' && !toggle.__rrnSearchAware) {
      const wrappedToggle = function(...args) {
        const result = toggle.apply(this, args);
        const term = activeSearchTerm();
        if (term) window.renderSetores?.(term);
        return result;
      };
      wrappedToggle.__rrnSearchAware = true;
      wrappedToggle.__rrnOriginal = toggle;
      window.toggleMachines = wrappedToggle;
    }

    const loadMore = window.rrnLoadMoreEquipment;
    if (typeof loadMore === 'function' && !loadMore.__rrnSearchAware) {
      const wrappedLoadMore = function(...args) {
        const result = loadMore.apply(this, args);
        const term = activeSearchTerm();
        if (term) window.renderSetores?.(term);
        return result;
      };
      wrappedLoadMore.__rrnSearchAware = true;
      wrappedLoadMore.__rrnOriginal = loadMore;
      window.rrnLoadMoreEquipment = wrappedLoadMore;
    }
  }

  function boot() {
    normalizeInventoryShape();
    window.filterMachines = filterMachinesStable;
    bindSearch();
    patchDropState();
    patchEquipmentNavigation();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.addEventListener('load', () => {
    boot();
    setTimeout(boot, 120);
  });
})();