(() => {
  'use strict';

  if (window.__RRN_SECTOR_CATEGORY_GUARD__) return;
  window.__RRN_SECTOR_CATEGORY_GUARD__ = true;

  const normalize = value => String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  function keepSectorOpen(sectorIndex) {
    const index = Number(sectorIndex);
    if (!Number.isInteger(index) || index < 0) return false;
    try {
      if (typeof setoresVisiveis !== 'undefined' && Array.isArray(setoresVisiveis)) {
        setoresVisiveis[index] = true;
      }
    } catch {}
    return true;
  }

  function strictCategory(asset) {
    const canonical = window.RRN_SECTOR_CATEGORIES?.categoryFor;
    if (typeof canonical === 'function') return canonical(asset);

    const value = normalize([
      asset?.tipo,
      asset?.tipoMaquina,
      asset?.nome,
      asset?.categoria
    ].filter(Boolean).join(' '));

    if (value.includes('monitor')) return 'monitors';
    if (value.includes('impress') || value.includes('printer')) return 'printers';
    if (value.includes('notebook') || value.includes('laptop')) return 'notebooks';
    if (value.includes('workstation')) return 'workstations';
    if (value.includes('desktop')) return 'desktops';
    if (value.includes('computador') || value.includes('maquina') || /(^|\s)pc(\s|$)/.test(value)) return 'computers';
    return 'others';
  }

  function restoreCategoryChooser(sectorIndex) {
    const index = Number(sectorIndex);
    if (!keepSectorOpen(index)) return;
    window.RRN_SECTOR_CATEGORIES?.back?.(index);
  }

  function enforceSector() {
    // Compatibility shim only. Category rendering/filtering is owned by
    // equipment-list-performance.js so a second DOM controller cannot
    // remove the category chooser after "Voltar às categorias".
  }

  function enforceAll() {}

  window.RRN_SECTOR_CATEGORY_GUARD = Object.freeze({
    strictCategory,
    enforceSector,
    enforceAll,
    restoreCategoryChooser
  });
})();
