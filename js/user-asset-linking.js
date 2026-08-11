(() => {
  'use strict';

  if (window.__RRN_USER_ASSET_LINKING__) return;
  window.__RRN_USER_ASSET_LINKING__ = true;

  const clean = value => String(value ?? '').trim();
  const normalizeName = value => clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();

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

  function firstValue(asset, keys) {
    for (const key of keys) {
      const value = clean(asset?.[key]);
      if (value) return value;
    }
    return '';
  }

  function responsibleName(asset) {
    return firstValue(asset, ['usuarioResponsavel', 'usuario', 'responsavel']);
  }

  function responsibleKey(asset) {
    const unique = firstValue(asset, [
      'usuarioId', 'userId', 'matricula', 'chapa', 'login', 'email', 'usuarioEmail'
    ]);
    if (unique) return `id:${normalizeName(unique)}`;
    const name = responsibleName(asset);
    return name ? `name:${normalizeName(name)}` : '';
  }

  function allAssets() {
    const rows = [];
    inventory().forEach((sector, sectorIndex) => {
      (Array.isArray(sector?.maquinas) ? sector.maquinas : []).forEach((asset, assetIndex) => {
        rows.push({
          asset,
          sectorIndex,
          assetIndex,
          sectorName: clean(sector?.nome) || `Setor ${sectorIndex + 1}`,
          key: responsibleKey(asset),
          responsible: responsibleName(asset)
        });
      });
    });
    return rows;
  }

  function groupFor(asset) {
    const key = responsibleKey(asset);
    if (!key) return [];
    return allAssets().filter(item => item.key === key);
  }

  function machineIndexes(card) {
    const si = Number(card?.dataset?.rrnSectorIndex);
    const ai = Number(card?.dataset?.rrnAssetIndex);
    if (Number.isInteger(si) && Number.isInteger(ai)) return [si, ai];
    const onclick = card?.querySelector('button[onclick*="showInfo("]')?.getAttribute('onclick') || '';
    const match = onclick.match(/showInfo\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
    return match ? [Number(match[1]), Number(match[2])] : null;
  }

  function ensureStyles() {
    if (document.getElementById('rrn-user-asset-linking-style')) return;
    const style = document.createElement('style');
    style.id = 'rrn-user-asset-linking-style';
    style.textContent = `
      .rrn-user-assets-badge{display:inline-flex;align-items:center;margin-top:4px;padding:2px 7px;border-radius:999px;color:#295991;background:rgba(242,191,79,.28);font-size:.56rem;font-weight:800;line-height:1.4}
      .rrn-related-assets{margin-top:14px;padding:12px;border:1px solid rgba(41,89,145,.15);border-radius:12px;background:rgba(255,255,255,.35)}
      .rrn-related-assets-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px}
      .rrn-related-assets-head strong{color:#295991;font-size:.78rem}.rrn-related-assets-head small{color:rgba(38,55,79,.62);font-size:.62rem}
      .rrn-related-assets-list{display:grid;gap:7px}.rrn-related-asset{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:8px 9px;border:1px solid rgba(41,89,145,.10);border-radius:9px;background:rgba(255,255,255,.42)}
      .rrn-related-asset.is-current{border-color:rgba(242,191,79,.55);background:rgba(242,191,79,.12)}
      .rrn-related-asset-copy strong,.rrn-related-asset-copy small{display:block}.rrn-related-asset-copy strong{color:#26374f;font-size:.7rem}.rrn-related-asset-copy small{margin-top:2px;color:rgba(38,55,79,.62);font-size:.6rem;line-height:1.35}
      .rrn-related-asset button{min-width:58px;padding:6px 8px!important;border:1px solid rgba(41,89,145,.18)!important;border-radius:8px!important;color:#295991!important;background:rgba(237,158,245,.18)!important;font-size:.62rem!important;font-weight:800!important;cursor:pointer}
      @media(max-width:480px){.rrn-related-asset{grid-template-columns:1fr}.rrn-related-asset button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function addCardBadge(card) {
    const indexes = machineIndexes(card);
    if (!indexes) return;
    const [sectorIndex, assetIndex] = indexes;
    const asset = inventory()[sectorIndex]?.maquinas?.[assetIndex];
    if (!asset) return;

    const group = groupFor(asset);
    const responsibleFact = [...card.querySelectorAll('.rrn-machine-fact')]
      .find(fact => fact.querySelector('small')?.textContent?.trim().toLowerCase() === 'responsável');
    if (!responsibleFact) return;

    responsibleFact.querySelector('.rrn-user-assets-badge')?.remove();
    if (group.length <= 1) return;

    const badge = document.createElement('span');
    badge.className = 'rrn-user-assets-badge';
    badge.textContent = `${group.length} ativos vinculados`;
    badge.title = group.map(item => `${clean(item.asset?.tipo) || 'Equipamento'} · ${clean(item.asset?.nome) || 'Sem nome'} · ${item.sectorName}`).join('\n');
    responsibleFact.querySelector('div')?.appendChild(badge);
  }

  function refreshCards(root = document) {
    if (root instanceof Element && root.matches('.rrn-machine-item')) addCardBadge(root);
    root.querySelectorAll?.('.rrn-machine-item').forEach(addCardBadge);
  }

  function assetLabel(item) {
    const asset = item.asset || {};
    const type = clean(asset.tipo) || 'Equipamento';
    const name = clean(asset.nome) || clean(asset.etiqueta) || 'Sem identificação';
    return `${type} · ${name}`;
  }

  function renderRelatedAssets(sectorIndex, assetIndex) {
    const asset = inventory()[sectorIndex]?.maquinas?.[assetIndex];
    const card = document.querySelector('#modalText .rrn-machine-detail-card');
    if (!asset || !card) return;

    card.querySelector('.rrn-related-assets')?.remove();
    const group = groupFor(asset);
    if (group.length <= 1) return;

    const section = document.createElement('section');
    section.className = 'rrn-related-assets';

    const head = document.createElement('div');
    head.className = 'rrn-related-assets-head';
    const title = document.createElement('strong');
    title.textContent = `Ativos de ${responsibleName(asset)}`;
    const count = document.createElement('small');
    count.textContent = `${group.length} ativos vinculados`;
    head.append(title, count);

    const list = document.createElement('div');
    list.className = 'rrn-related-assets-list';
    group.forEach(item => {
      const row = document.createElement('div');
      row.className = 'rrn-related-asset';
      const current = item.sectorIndex === sectorIndex && item.assetIndex === assetIndex;
      if (current) row.classList.add('is-current');

      const copy = document.createElement('div');
      copy.className = 'rrn-related-asset-copy';
      const strong = document.createElement('strong');
      strong.textContent = assetLabel(item);
      const small = document.createElement('small');
      const patrimony = firstValue(item.asset, ['etiqueta', 'patrimonio', 'placa']);
      small.textContent = [item.sectorName, patrimony ? `Patrimônio ${patrimony}` : '', current ? 'Ativo atual' : ''].filter(Boolean).join(' · ');
      copy.append(strong, small);
      row.appendChild(copy);

      if (!current) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'Abrir';
        button.addEventListener('click', () => window.showInfo?.(item.sectorIndex, item.assetIndex));
        row.appendChild(button);
      }
      list.appendChild(row);
    });

    section.append(head, list);
    card.appendChild(section);
  }

  function wrapShowInfo() {
    const original = window.showInfo;
    if (typeof original !== 'function' || original.__rrnUserAssetWrapped) return;
    const wrapped = function(sectorIndex, assetIndex, ...rest) {
      const result = original.call(this, sectorIndex, assetIndex, ...rest);
      queueMicrotask(() => renderRelatedAssets(Number(sectorIndex), Number(assetIndex)));
      return result;
    };
    wrapped.__rrnUserAssetWrapped = true;
    wrapped.__rrnOriginal = original;
    window.showInfo = wrapped;
  }

  function boot() {
    ensureStyles();
    wrapShowInfo();
    refreshCards();

    const container = document.getElementById('setoresContainer');
    if (container) {
      new MutationObserver(records => {
        records.forEach(record => record.addedNodes.forEach(node => {
          if (node instanceof Element) refreshCards(node);
        }));
      }).observe(container, { childList: true, subtree: true });
    }

    window.addEventListener('storage', event => {
      if (event.key === 'setores') refreshCards();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.RRN_USER_ASSETS = Object.freeze({ groupFor, refreshCards, renderRelatedAssets });
})();