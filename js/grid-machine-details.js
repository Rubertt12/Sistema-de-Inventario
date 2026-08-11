(() => {
  'use strict';

  if (window.__RRN_GRID_MACHINE_DETAILS__) return;
  window.__RRN_GRID_MACHINE_DETAILS__ = true;

  const normalize = value => String(value ?? '').trim();

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

  function machineIndexes(card) {
    const button = card.querySelector('button[onclick*="showInfo("]');
    const code = button?.getAttribute('onclick') || '';
    const match = code.match(/showInfo\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
    return match ? [Number(match[1]), Number(match[2])] : null;
  }

  function firstValue(asset, keys) {
    for (const key of keys) {
      const value = normalize(asset?.[key]);
      if (value) return value;
    }
    return '';
  }

  function statusInfo(asset) {
    if (asset?.emManutencao) return { label: 'Em manutenção', className: 'maintenance' };
    const raw = firstValue(asset, ['situacaoPatrimonial', 'status', 'situacao']).toLowerCase();
    if (raw.includes('estoque')) return { label: 'Em estoque', className: 'stock' };
    if (raw.includes('emprest')) return { label: 'Emprestado', className: 'loan' };
    if (raw.includes('baix') || raw.includes('inativ') || raw.includes('descart')) return { label: 'Baixado', className: 'inactive' };
    return { label: 'Operando', className: 'online' };
  }

  function createFact(icon, label, value, emptyLabel = 'Não informado', key = '') {
    const item = document.createElement('div');
    item.className = 'rrn-machine-fact';
    if (key) item.dataset.fact = key;

    const iconWrap = document.createElement('span');
    iconWrap.className = 'rrn-machine-fact-icon';
    iconWrap.dataset.rrnIcon = icon;
    iconWrap.setAttribute('aria-hidden', 'true');

    const copy = document.createElement('div');
    const caption = document.createElement('small');
    caption.textContent = label;
    const strong = document.createElement('strong');
    strong.textContent = normalize(value) || emptyLabel;
    if (!normalize(value)) item.classList.add('is-empty');

    copy.append(caption, strong);
    item.append(iconWrap, copy);
    return item;
  }

  function enhanceCard(card) {
    if (!(card instanceof Element) || !card.matches('.rrn-machine-item')) return;
    const indexes = machineIndexes(card);
    if (!indexes) return;

    const [sectorIndex, assetIndex] = indexes;
    const sector = inventory()[sectorIndex];
    const asset = sector?.maquinas?.[assetIndex];
    if (!asset) return;

    card.dataset.rrnMachineEnhanced = '1';
    card.dataset.rrnSectorIndex = String(sectorIndex);
    card.dataset.rrnAssetIndex = String(assetIndex);

    const status = statusInfo(asset);
    const statusEl = card.querySelector('.rrn-status');
    if (statusEl) {
      statusEl.textContent = status.label;
      statusEl.classList.remove('online', 'maintenance', 'stock', 'loan', 'inactive');
      statusEl.classList.add(status.className);
    }
    card.classList.remove('online', 'maintenance', 'stock', 'loan', 'inactive');
    card.classList.add(status.className);

    const main = card.querySelector('.rrn-machine-main');
    if (!main) return;

    main.querySelector('.rrn-machine-product-line')?.remove();
    main.querySelector('.rrn-machine-grid-details')?.remove();

    const manufacturer = firstValue(asset, ['fabricante', 'manufacturer', 'marca']);
    const model = firstValue(asset, ['modelo', 'model']);
    const product = [manufacturer, model].filter(Boolean).join(' · ');
    if (product) {
      const productLine = document.createElement('div');
      productLine.className = 'rrn-machine-product-line';
      productLine.textContent = product;
      const meta = main.querySelector('.rrn-machine-meta');
      if (meta) meta.before(productLine);
      else main.appendChild(productLine);
    }

    const details = document.createElement('div');
    details.className = 'rrn-machine-grid-details';

    const patrimony = firstValue(asset, ['etiqueta', 'patrimonio', 'patrimonial', 'placa']);
    const user = firstValue(asset, ['usuarioResponsavel', 'usuario', 'responsavel']);
    const location = firstValue(asset, ['localizacao', 'location', 'local']) || normalize(sector?.nome);
    const serial = firstValue(asset, ['serial', 'numeroSerie', 'serviceTag']);
    const warranty = firstValue(asset, ['garantiaAte', 'garantia', 'dataGarantia']);

    details.append(
      createFact('tag', 'Patrimônio', patrimony, 'Sem etiqueta', 'patrimony'),
      createFact('user', 'Responsável', user, 'Sem responsável', 'responsible'),
      createFact('building', 'Localização', location, 'Sem localização', 'location')
    );

    // Campos complementares só aparecem quando realmente têm conteúdo.
    // Evita caixas vazias/fallbacks que deixam o grid alto e visualmente pesado.
    if (serial) details.append(createFact('monitor', 'Serial / Service Tag', serial, '', 'serial'));
    if (warranty) details.append(createFact('calendar', 'Garantia até', warranty, '', 'warranty'));

    main.appendChild(details);

    const infoButton = card.querySelector('.rrn-btn-info');
    if (infoButton) {
      infoButton.textContent = 'Detalhes';
      infoButton.dataset.rrnIcon = 'info';
      infoButton.title = 'Abrir ficha completa do equipamento';
    }

    window.RRN_ICONS?.decorateStatic?.(card);
  }

  function enhanceAll(root = document) {
    if (root instanceof Element && root.matches('.rrn-machine-item')) enhanceCard(root);
    root.querySelectorAll?.('.rrn-machine-item').forEach(enhanceCard);
  }

  function boot() {
    enhanceAll();
    const container = document.getElementById('setoresContainer');
    if (!container) return;

    const observer = new MutationObserver(records => {
      for (const record of records) {
        record.addedNodes.forEach(node => {
          if (node instanceof Element) enhanceAll(node);
        });
      }
    });
    observer.observe(container, { childList: true, subtree: true });

    window.addEventListener('storage', event => {
      if (event.key === 'setores') enhanceAll(container);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.RRN_GRID_DETAILS = Object.freeze({ enhanceAll });
})();