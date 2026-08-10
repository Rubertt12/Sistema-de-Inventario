(() => {
  'use strict';

  function inventory() {
    try { return Array.isArray(setores) ? setores : []; }
    catch { return []; }
  }

  function assetKey(asset) {
    if (!asset) return '';
    if (asset.id != null && String(asset.id).trim()) return `id:${String(asset.id)}`;
    if (asset.etiqueta) return `tag:${String(asset.etiqueta).trim().toLowerCase()}`;
    return `legacy:${String(asset.nome || '').trim().toLowerCase()}|${String(asset.tipo || '').trim().toLowerCase()}`;
  }

  function recordAssetRemoved(asset, sectorName) {
    window.RRN_HISTORY?.recordEvent?.({
      entityType: 'asset',
      entityId: assetKey(asset),
      eventType: 'deleted',
      source: 'lixeira',
      title: 'Equipamento movido para a lixeira',
      assetLabel: asset?.etiqueta || asset?.nome || 'Equipamento',
      fromSector: sectorName || '',
      details: { asset: JSON.parse(JSON.stringify(asset || {})) }
    });
  }

  function wrapRemoveAsset() {
    const current = window.removeMaquina;
    if (typeof current !== 'function' || current.__rrnTrashAudited) return;
    const wrapped = function(sectorIndex, assetIndex) {
      const sector = inventory()[sectorIndex];
      const asset = sector?.maquinas?.[assetIndex];
      const id = assetKey(asset);
      const beforeLength = sector?.maquinas?.length ?? 0;
      const result = current.apply(this, arguments);
      setTimeout(() => {
        const afterSector = inventory()[sectorIndex];
        const stillExists = (afterSector?.maquinas || []).some(item => assetKey(item) === id);
        if (asset && beforeLength > 0 && !stillExists) recordAssetRemoved(asset, sector?.nome || '');
      }, 0);
      return result;
    };
    wrapped.__rrnTrashAudited = true;
    wrapped.__rrnOriginal = current;
    window.removeMaquina = wrapped;
  }

  function wrapRemoveSector() {
    const current = window.removeSetor;
    if (typeof current !== 'function' || current.__rrnTrashAudited) return;
    const wrapped = function(sectorIndex) {
      const sector = inventory()[sectorIndex];
      const beforeCount = inventory().length;
      const result = current.apply(this, arguments);
      setTimeout(() => {
        const removed = sector && inventory().length < beforeCount && !inventory().includes(sector);
        if (!removed) return;
        window.RRN_HISTORY?.recordEvent?.({
          entityType: 'sector',
          entityId: `sector:${String(sector.nome || sectorIndex).toLowerCase()}`,
          eventType: 'sector_deleted',
          source: 'lixeira',
          title: 'Setor movido para a lixeira',
          assetLabel: sector.nome || 'Setor',
          fromSector: sector.nome || '',
          details: { equipmentCount: Array.isArray(sector.maquinas) ? sector.maquinas.length : 0 }
        });
      }, 0);
      return result;
    };
    wrapped.__rrnTrashAudited = true;
    wrapped.__rrnOriginal = current;
    window.removeSetor = wrapped;
  }

  function boot() {
    wrapRemoveAsset();
    wrapRemoveSector();
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      wrapRemoveAsset();
      wrapRemoveSector();
      if (attempts >= 12) clearInterval(timer);
    }, 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
