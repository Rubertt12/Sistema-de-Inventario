(() => {
  'use strict';

  if (window.__RRN_STOCK_INVENTORY_V2__) return;
  window.__RRN_STOCK_INVENTORY_V2__ = true;

  const STOCK_KEY = 'rrn_stock_assets';
  const state = {
    query: '',
    type: 'all',
    selected: new Set(),
    importRows: [],
    scan: { instance: null, starting: false, locked: false, seen: 0, added: 0, duplicates: 0 }
  };

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
  const norm = value => String(value ?? '').trim().toLowerCase();
  const fold = value => norm(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  const nowIso = () => new Date().toISOString();

  function inventory() {
    try { if (typeof setores !== 'undefined' && Array.isArray(setores)) return setores; } catch {}
    try {
      const parsed = JSON.parse(localStorage.getItem('setores') || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  function directStock() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STOCK_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  function writeDirectStock(list) {
    localStorage.setItem(STOCK_KEY, JSON.stringify(Array.isArray(list) ? list : []));
    window.dispatchEvent(new CustomEvent('rrn:stock-update'));
  }

  function canOperate() {
    const role = window.RRN_SESSION?.role || (() => {
      try { return JSON.parse(localStorage.getItem('usuarioLogado') || '{}').perfil; } catch { return null; }
    })();
    return role == null || role === 'admin' || role === 'operador';
  }

  function uid() {
    if (crypto?.randomUUID) return `stock_${crypto.randomUUID()}`;
    return `stock_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function typeLabel(asset) {
    return String(asset?.tipoMaquina || asset?.tipo || 'Equipamento').trim() || 'Equipamento';
  }

  function assetLabel(asset) {
    return String(asset?.etiqueta || asset?.patrimonio || asset?.nome || asset?.numeroSerie || asset?.serial || 'Sem identificação').trim();
  }

  function serialLabel(asset) {
    return String(asset?.serial || asset?.numeroSerie || asset?.serviceTag || asset?.nome || '—').trim();
  }

  function modelLabel(asset) {
    return [asset?.fabricante, asset?.modelo].filter(Boolean).join(' ').trim() || typeLabel(asset);
  }

  function recordKey(source, indexA, indexB, asset) {
    const id = String(asset?.id ?? '').trim();
    if (id) return `${source}:id:${id}`;
    return `${source}:${indexA}:${indexB ?? ''}:${fold(asset?.etiqueta)}:${fold(serialLabel(asset))}`;
  }

  function stockRecords() {
    const rows = [];

    directStock().forEach((asset, directIndex) => {
      const status = norm(asset?.situacaoPatrimonial || 'estoque');
      if (!status.includes('estoque') || asset?.emManutencao || norm(asset?.usuarioResponsavel)) return;
      rows.push({
        source: 'direct',
        asset,
        directIndex,
        sectorIndex: null,
        assetIndex: null,
        sectorName: 'Estoque TI',
        key: recordKey('direct', directIndex, null, asset)
      });
    });

    inventory().forEach((sector, sectorIndex) => {
      (Array.isArray(sector?.maquinas) ? sector.maquinas : []).forEach((asset, assetIndex) => {
        const status = norm(asset?.situacaoPatrimonial);
        if (!status.includes('estoque') || asset?.emManutencao || norm(asset?.usuarioResponsavel)) return;
        rows.push({
          source: 'sector',
          asset,
          directIndex: null,
          sectorIndex,
          assetIndex,
          sectorName: sector?.nome || `Setor ${sectorIndex + 1}`,
          key: recordKey('sector', sectorIndex, assetIndex, asset)
        });
      });
    });

    return rows;
  }

  function filteredRecords() {
    return stockRecords().filter(row => {
      const typeOk = state.type === 'all' || norm(typeLabel(row.asset)) === state.type;
      if (!typeOk) return false;
      if (!state.query) return true;
      const haystack = [
        row.asset?.etiqueta, row.asset?.patrimonio, row.asset?.nome, row.asset?.numeroSerie,
        row.asset?.serial, row.asset?.serviceTag, row.asset?.fabricante, row.asset?.modelo,
        typeLabel(row.asset), row.sectorName
      ].map(norm).join(' ');
      return haystack.includes(state.query);
    });
  }

  function typeCounts(rows = stockRecords()) {
    const map = new Map();
    rows.forEach(row => {
      const label = typeLabel(row.asset);
      map.set(label, (map.get(label) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }

  function identityValues(asset) {
    return [
      asset?.etiqueta, asset?.patrimonio, asset?.serial, asset?.numeroSerie,
      asset?.serviceTag, asset?.nome
    ].map(fold).filter(Boolean);
  }

  function findDuplicate(candidate, extra = []) {
    const ids = new Set(identityValues(candidate));
    if (!ids.size) return null;

    const sources = [
      ...directStock().map(asset => ({ asset, where: 'Máquinas em estoque' })),
      ...inventory().flatMap(sector => (Array.isArray(sector?.maquinas) ? sector.maquinas : [])
        .map(asset => ({ asset, where: sector?.nome || 'Inventário' }))),
      ...extra.map(asset => ({ asset, where: 'arquivo atual' }))
    ];

    return sources.find(item => identityValues(item.asset).some(value => ids.has(value))) || null;
  }

  function makeAsset(data = {}, source = 'manual') {
    const type = String(data.tipo || 'Equipamento').trim() || 'Equipamento';
    const patrimonio = String(data.patrimonio || data.etiqueta || '').trim();
    const serial = String(data.serial || data.numeroSerie || '').trim();
    const created = nowIso();
    const asset = {
      id: uid(),
      nome: serial || patrimonio || `${type} ${Date.now()}`,
      tipo: type,
      etiqueta: patrimonio,
      patrimonio,
      serial,
      numeroSerie: serial,
      fabricante: String(data.fabricante || '').trim(),
      modelo: String(data.modelo || '').trim(),
      usuarioResponsavel: '',
      situacaoPatrimonial: 'estoque',
      emManutencao: false,
      tempoManutencao: 0,
      chamado: [],
      chamados: [],
      origemEstoque: source,
      cadastradoEm: created,
      atualizadoEm: created
    };
    if (['notebook', 'desktop', 'workstation'].includes(norm(type))) asset.tipoMaquina = type;
    return asset;
  }

  function persistInventory() {
    if (typeof window.saveSetoresAndMachines === 'function') window.saveSetoresAndMachines();
    else localStorage.setItem('setores', JSON.stringify(inventory()));
  }

  function ensureStyle() {
    if (document.getElementById('rrn-stock-v2-style')) return;
    const style = document.createElement('style');
    style.id = 'rrn-stock-v2-style';
    style.textContent = `
      .rrn-app-tab[data-app-tab="stock"]{font-size:0!important}
      .rrn-app-tab[data-app-tab="stock"]::after{content:"Máquinas em estoque";font-size:.72rem}
      body.rrn-tab-stock .rrn-dashboard-home,body.rrn-tab-stock>main,body.rrn-tab-stock .dashboard-actions{display:none!important}
      body.rrn-tab-stock #searchInput{display:none!important}
      .rrn-stock-view{display:none;width:calc(100% - clamp(32px,4vw,72px));margin:22px auto 34px;color:var(--rrn-text,#263238)}
      body.rrn-tab-stock .rrn-stock-view{display:block}
      .rrn-stock-hero{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;padding:22px 24px;border:1px solid var(--rrn-border,rgba(22,58,77,.14));border-left:5px solid var(--rrn-secondary,#2F7D78);border-radius:17px;background:var(--rrn-surface,#fff);box-shadow:0 9px 28px rgba(22,58,77,.07)}
      .rrn-stock-eyebrow{display:block;margin-bottom:5px;color:var(--rrn-secondary,#2F7D78);font-size:.66rem;font-weight:850;letter-spacing:.09em;text-transform:uppercase}
      .rrn-stock-hero h2{margin:0!important;color:var(--rrn-heading,#163A4D)!important;font:750 clamp(1.35rem,2.3vw,2rem)/1.15 Manrope,Inter,sans-serif!important;text-align:left!important}
      .rrn-stock-hero p{max-width:780px;margin:7px 0 0;color:var(--rrn-muted,#66757F);font-size:.78rem;line-height:1.5}
      .rrn-stock-total{align-self:start;min-width:130px;padding:12px 15px;border:1px solid var(--rrn-border,rgba(22,58,77,.12));border-radius:13px;background:var(--rrn-surface-2,#f5f8f9);text-align:right}
      .rrn-stock-total span,.rrn-stock-total strong{display:block}.rrn-stock-total span{color:var(--rrn-muted,#66757F);font-size:.62rem;font-weight:800;text-transform:uppercase}.rrn-stock-total strong{margin-top:4px;color:var(--rrn-heading,#163A4D);font-size:1.75rem;line-height:1}
      .rrn-stock-intake-actions{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:8px;padding-top:2px}
      .rrn-stock-intake-actions button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:40px;padding:0 13px;border:1px solid var(--rrn-border,rgba(22,58,77,.16));border-radius:10px;background:var(--rrn-surface-2,#f5f8f9);color:var(--rrn-heading,#163A4D);font:800 .7rem Inter,sans-serif;cursor:pointer}
      .rrn-stock-intake-actions button.primary{border-color:var(--rrn-secondary,#2F7D78);background:var(--rrn-secondary,#2F7D78);color:#fff}
      .rrn-stock-intake-actions button:hover{transform:translateY(-1px)}
      .rrn-stock-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:13px 0}
      .rrn-stock-kpi{padding:14px;border:1px solid var(--rrn-border,rgba(22,58,77,.12));border-radius:13px;background:var(--rrn-surface,#fff)}
      .rrn-stock-kpi span,.rrn-stock-kpi strong{display:block}.rrn-stock-kpi span{overflow:hidden;color:var(--rrn-muted,#66757F);font-size:.64rem;font-weight:700;text-overflow:ellipsis;white-space:nowrap}.rrn-stock-kpi strong{margin-top:6px;color:var(--rrn-heading,#163A4D);font-size:1.25rem}
      .rrn-stock-panel{padding:18px;border:1px solid var(--rrn-border,rgba(22,58,77,.14));border-radius:16px;background:var(--rrn-surface,#fff);box-shadow:0 8px 25px rgba(22,58,77,.05)}
      .rrn-stock-toolbar{display:grid;grid-template-columns:minmax(220px,1fr) 190px auto;gap:10px;align-items:center;margin-bottom:14px}
      .rrn-stock-toolbar input,.rrn-stock-toolbar select,.rrn-stock-field input,.rrn-stock-field select{width:100%;min-height:42px;padding:9px 11px;border:1px solid var(--rrn-border,rgba(22,58,77,.16));border-radius:10px;background:var(--rrn-surface,#fff);color:var(--rrn-text,#263238);font:600 .72rem Inter,sans-serif;outline:none}
      .rrn-stock-toolbar input:focus,.rrn-stock-toolbar select:focus,.rrn-stock-field input:focus,.rrn-stock-field select:focus{border-color:var(--rrn-secondary,#2F7D78);box-shadow:0 0 0 3px color-mix(in srgb,var(--rrn-secondary,#2F7D78) 12%,transparent)}
      .rrn-stock-bulk{min-height:42px;padding:0 14px;border:1px solid var(--rrn-secondary,#2F7D78);border-radius:10px;background:var(--rrn-secondary,#2F7D78);color:#fff;font:800 .7rem Inter,sans-serif;cursor:pointer}
      .rrn-stock-bulk:disabled{opacity:.45;cursor:not-allowed}
      .rrn-stock-list{display:flex;flex-direction:column;gap:8px}
      .rrn-stock-row{display:grid;grid-template-columns:30px minmax(160px,1.25fr) minmax(120px,.7fr) minmax(140px,.8fr) minmax(120px,.7fr) auto;gap:12px;align-items:center;padding:12px 13px;border:1px solid var(--rrn-border,rgba(22,58,77,.1));border-radius:12px;background:var(--rrn-surface-2,#f7f9f9)}
      .rrn-stock-check{display:grid;place-items:center}.rrn-stock-check input{width:16px;height:16px;accent-color:var(--rrn-secondary,#2F7D78)}
      .rrn-stock-main strong,.rrn-stock-main small,.rrn-stock-meta strong,.rrn-stock-meta small{display:block}
      .rrn-stock-main strong{overflow:hidden;color:var(--rrn-heading,#163A4D);font-size:.76rem;text-overflow:ellipsis;white-space:nowrap}
      .rrn-stock-main small,.rrn-stock-meta small{margin-top:3px;color:var(--rrn-muted,#66757F);font-size:.61rem}
      .rrn-stock-meta strong{overflow:hidden;color:var(--rrn-text,#263238);font-size:.68rem;text-overflow:ellipsis;white-space:nowrap}
      .rrn-stock-status{display:inline-flex;width:max-content;margin-top:4px;padding:3px 7px;border-radius:999px;background:color-mix(in srgb,var(--rrn-secondary,#2F7D78) 12%,transparent);color:var(--rrn-secondary,#2F7D78);font-size:.57rem;font-weight:850}
      .rrn-stock-actions{display:flex;gap:6px;justify-content:flex-end}.rrn-stock-actions button{min-height:34px;padding:0 10px;border:1px solid var(--rrn-border,rgba(22,58,77,.14));border-radius:8px;background:var(--rrn-surface,#fff);color:var(--rrn-heading,#163A4D);font:800 .63rem Inter,sans-serif;cursor:pointer}.rrn-stock-actions button.primary{border-color:var(--rrn-secondary,#2F7D78);background:var(--rrn-secondary,#2F7D78);color:#fff}
      .rrn-stock-empty{padding:42px 18px;border:1px dashed var(--rrn-border,rgba(22,58,77,.15));border-radius:13px;text-align:center;color:var(--rrn-muted,#66757F)}.rrn-stock-empty strong,.rrn-stock-empty small{display:block}.rrn-stock-empty strong{color:var(--rrn-heading,#163A4D);font-size:.86rem}.rrn-stock-empty small{margin-top:5px;font-size:.7rem}
      .rrn-stock-modal{position:fixed;inset:0;z-index:33000;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(5,18,25,.72);backdrop-filter:blur(9px)}
      .rrn-stock-modal.is-open{display:flex}
      .rrn-stock-dialog{width:min(600px,100%);max-height:calc(100dvh - 32px);overflow:auto;padding:20px;border:1px solid var(--rrn-border,rgba(22,58,77,.14));border-radius:17px;background:var(--rrn-surface,#fff);color:var(--rrn-text,#263238);box-shadow:0 25px 75px rgba(0,0,0,.35)}
      .rrn-stock-dialog.wide{width:min(880px,100%)}
      .rrn-stock-dialog-head{display:flex;align-items:flex-start;justify-content:space-between;gap:15px;margin-bottom:16px}.rrn-stock-dialog h3{margin:0;color:var(--rrn-heading,#163A4D);font-size:1.05rem}.rrn-stock-dialog p{margin:5px 0 0;color:var(--rrn-muted,#66757F);font-size:.7rem;line-height:1.45}
      .rrn-stock-close{display:grid;place-items:center;flex:0 0 auto;width:36px;height:36px;border:0;border-radius:9px;background:var(--rrn-heading,#163A4D);color:#fff;font-size:1.15rem;cursor:pointer}
      .rrn-stock-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 12px}.rrn-stock-field{display:block;margin-top:12px}.rrn-stock-field.full{grid-column:1/-1}.rrn-stock-field span{display:block;margin-bottom:6px;color:var(--rrn-heading,#163A4D);font-size:.68rem;font-weight:800}
      .rrn-stock-dialog-actions{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:8px;margin-top:18px}.rrn-stock-dialog-actions button{min-height:39px;padding:0 13px;border:1px solid var(--rrn-border,rgba(22,58,77,.15));border-radius:9px;background:var(--rrn-surface-2,#f7f9f9);color:var(--rrn-heading,#163A4D);font-weight:800;cursor:pointer}.rrn-stock-dialog-actions button.primary{border-color:var(--rrn-secondary,#2F7D78);background:var(--rrn-secondary,#2F7D78);color:#fff}
      .rrn-stock-reader{min-height:250px;margin:10px 0 12px;overflow:hidden;border:1px solid var(--rrn-border,rgba(22,58,77,.14));border-radius:13px;background:#08161c}
      .rrn-stock-reader video{border-radius:12px}
      .rrn-stock-scan-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0}.rrn-stock-scan-stat{padding:9px 10px;border:1px solid var(--rrn-border,rgba(22,58,77,.12));border-radius:10px;background:var(--rrn-surface-2,#f7f9f9)}.rrn-stock-scan-stat span,.rrn-stock-scan-stat strong{display:block}.rrn-stock-scan-stat span{color:var(--rrn-muted,#66757F);font-size:.58rem;font-weight:800;text-transform:uppercase}.rrn-stock-scan-stat strong{margin-top:3px;color:var(--rrn-heading,#163A4D)}
      .rrn-stock-inline-note{margin-top:10px;padding:10px 11px;border-radius:10px;background:var(--rrn-surface-2,#f7f9f9);color:var(--rrn-muted,#66757F);font-size:.68rem;line-height:1.45}.rrn-stock-inline-note.warn{background:rgba(217,119,69,.12);color:#a6532b}.rrn-stock-inline-note.ok{background:rgba(47,125,120,.12);color:var(--rrn-secondary,#2F7D78)}
      .rrn-stock-import-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}.rrn-stock-import-summary article{padding:11px;border:1px solid var(--rrn-border,rgba(22,58,77,.12));border-radius:10px;background:var(--rrn-surface-2,#f7f9f9)}.rrn-stock-import-summary span,.rrn-stock-import-summary strong{display:block}.rrn-stock-import-summary span{color:var(--rrn-muted,#66757F);font-size:.58rem;font-weight:800;text-transform:uppercase}.rrn-stock-import-summary strong{margin-top:4px;color:var(--rrn-heading,#163A4D);font-size:1.2rem}
      .rrn-stock-preview{max-height:310px;overflow:auto;border:1px solid var(--rrn-border,rgba(22,58,77,.12));border-radius:11px}.rrn-stock-preview-row{display:grid;grid-template-columns:1fr .8fr .8fr;gap:8px;padding:9px 10px;border-bottom:1px solid var(--rrn-border,rgba(22,58,77,.08));font-size:.65rem}.rrn-stock-preview-row:last-child{border-bottom:0}.rrn-stock-preview-row strong{color:var(--rrn-heading,#163A4D)}
      .rrn-stock-toast{position:fixed;right:20px;bottom:20px;z-index:35000;max-width:min(420px,calc(100vw - 32px));padding:12px 15px;border-radius:11px;background:var(--rrn-heading,#163A4D);color:#fff;box-shadow:0 14px 36px rgba(0,0,0,.25);font:750 .72rem Inter,sans-serif}
      @media(max-width:1000px){.rrn-stock-row{grid-template-columns:28px minmax(150px,1.2fr) minmax(110px,.7fr) minmax(120px,.8fr) auto}.rrn-stock-row .rrn-stock-meta:nth-of-type(4){display:none}}
      @media(max-width:700px){
        .rrn-stock-view{width:calc(100% - 16px);margin:14px 8px 26px}.rrn-stock-hero{grid-template-columns:1fr;padding:17px}.rrn-stock-total{width:100%;display:flex;align-items:center;justify-content:space-between;text-align:left}.rrn-stock-total strong{margin:0}
        .rrn-stock-intake-actions{display:grid;grid-template-columns:1fr 1fr}.rrn-stock-intake-actions button:first-child{grid-column:1/-1}.rrn-stock-kpis{grid-template-columns:1fr 1fr}.rrn-stock-panel{padding:12px}.rrn-stock-toolbar{grid-template-columns:1fr}.rrn-stock-bulk{width:100%}
        .rrn-stock-row{position:relative;grid-template-columns:26px minmax(0,1fr);gap:8px 10px;padding:12px}.rrn-stock-main{padding-right:4px}.rrn-stock-meta{grid-column:2}.rrn-stock-actions{grid-column:1/-1;justify-content:stretch;margin-top:3px}.rrn-stock-actions button{flex:1}.rrn-stock-check{grid-row:1/5;align-self:start;padding-top:2px}
        .rrn-stock-form-grid{grid-template-columns:1fr}.rrn-stock-field.full{grid-column:auto}.rrn-stock-dialog{padding:16px}.rrn-stock-reader{min-height:210px}.rrn-stock-preview-row{grid-template-columns:1fr}.rrn-app-tab[data-app-tab="stock"]::after{content:"Estoque"}
      }
    `;
    document.head.appendChild(style);
  }

  function ensureView() {
    let view = document.getElementById('rrnStockInventoryView');
    if (view) return view;
    view = document.createElement('section');
    view.id = 'rrnStockInventoryView';
    view.className = 'rrn-stock-view';
    document.body.appendChild(view);
    return view;
  }

  function ensureTab() {
    const tabs = document.querySelector('.rrn-app-tabs');
    if (!tabs || tabs.querySelector('[data-app-tab="stock"]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rrn-app-tab';
    button.dataset.appTab = 'stock';
    button.dataset.rrnIcon = 'box';
    button.setAttribute('role', 'tab');
    button.textContent = 'Máquinas em estoque';
    button.addEventListener('click', openStockTab);
    tabs.appendChild(button);
    tabs.querySelectorAll('[data-app-tab="dashboard"],[data-app-tab="inventory"]').forEach(existing => {
      existing.addEventListener('click', closeStockMode, true);
    });
    window.RRN_ICONS?.decorateStatic?.(button);
  }

  function closeStockMode() {
    document.body.classList.remove('rrn-tab-stock');
    const tab = document.querySelector('[data-app-tab="stock"]');
    tab?.classList.remove('is-active');
    tab?.setAttribute('aria-selected', 'false');
  }

  function openStockTab() {
    ensureTab();
    ensureView();
    document.body.classList.remove('rrn-tab-dashboard', 'rrn-tab-inventory');
    document.body.classList.add('rrn-tab-stock');
    document.querySelectorAll('[data-app-tab]').forEach(button => {
      const active = button.dataset.appTab === 'stock';
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
    history.replaceState(null, '', `${location.pathname}${location.search}#stock`);
    render();
  }

  function render() {
    const view = ensureView();
    const all = stockRecords();
    const rows = filteredRecords();
    const buckets = typeCounts(all);
    const top = buckets.slice(0, 4);
    while (top.length < 4) top.push(['—', 0]);

    const valid = new Set(all.map(row => row.key));
    [...state.selected].forEach(key => { if (!valid.has(key)) state.selected.delete(key); });
    const types = [...new Set(all.map(row => typeLabel(row.asset)))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

    view.innerHTML = `
      <section class="rrn-stock-hero">
        <div><span class="rrn-stock-eyebrow">Estoque da TI</span><h2>Máquinas em estoque</h2><p>Cadastre equipamentos sem escolher setor, faça leitura rápida por câmera ou leitor e importe lotes de Excel/CSV. Eles permanecem aqui até serem alocados.</p></div>
        <div class="rrn-stock-total"><span>Total disponível</span><strong>${all.length}</strong></div>
        ${canOperate() ? `<div class="rrn-stock-intake-actions">
          <button type="button" class="primary" data-stock-add>＋ Cadastrar equipamento</button>
          <button type="button" data-stock-scan>📷 Leitura rápida</button>
          <button type="button" data-stock-import>📊 Importar Excel / CSV</button>
          <input type="file" data-stock-import-file accept=".xlsx,.xls,.csv,text/csv" hidden>
        </div>` : ''}
      </section>
      <section class="rrn-stock-kpis">${top.map(([label, count]) => `<article class="rrn-stock-kpi"><span>${esc(label)}</span><strong>${count}</strong></article>`).join('')}</section>
      <section class="rrn-stock-panel">
        <div class="rrn-stock-toolbar">
          <input type="search" data-stock-search placeholder="Pesquisar patrimônio, série, modelo..." value="${esc(state.query)}">
          <select data-stock-type><option value="all">Todos os tipos</option>${types.map(type => `<option value="${esc(norm(type))}" ${state.type === norm(type) ? 'selected' : ''}>${esc(type)}</option>`).join('')}</select>
          <button type="button" class="rrn-stock-bulk" data-stock-bulk ${!state.selected.size || !canOperate() ? 'disabled' : ''}>Alocar selecionadas (${state.selected.size})</button>
        </div>
        <div class="rrn-stock-list">
          ${rows.length ? rows.map(row => {
            const asset = row.asset;
            return `<article class="rrn-stock-row" data-stock-key="${esc(row.key)}">
              <label class="rrn-stock-check"><input type="checkbox" data-stock-select="${esc(row.key)}" ${state.selected.has(row.key) ? 'checked' : ''} ${!canOperate() ? 'disabled' : ''}></label>
              <div class="rrn-stock-main"><strong>${esc(assetLabel(asset))}</strong><small>${esc(modelLabel(asset))}</small><span class="rrn-stock-status">Em estoque</span></div>
              <div class="rrn-stock-meta"><small>Tipo</small><strong>${esc(typeLabel(asset))}</strong></div>
              <div class="rrn-stock-meta"><small>Nº de série</small><strong>${esc(serialLabel(asset))}</strong></div>
              <div class="rrn-stock-meta"><small>Local atual</small><strong>${esc(row.sectorName)}</strong></div>
              <div class="rrn-stock-actions"><button type="button" data-stock-details="${esc(row.key)}">Detalhes</button>${canOperate() ? `<button type="button" class="primary" data-stock-allocate="${esc(row.key)}">Alocar</button>` : ''}</div>
            </article>`;
          }).join('') : `<div class="rrn-stock-empty"><strong>Nenhum equipamento em estoque</strong><small>Use “Cadastrar equipamento”, “Leitura rápida” ou importe uma planilha para começar.</small></div>`}
        </div>
      </section>`;

    view.querySelector('[data-stock-search]')?.addEventListener('input', e => {
      state.query = norm(e.target.value);
      render();
      requestAnimationFrame(() => {
        const input = view.querySelector('[data-stock-search]');
        if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
      });
    });
    view.querySelector('[data-stock-type]')?.addEventListener('change', e => { state.type = e.target.value; render(); });
    view.querySelectorAll('[data-stock-select]').forEach(input => input.addEventListener('change', () => {
      if (input.checked) state.selected.add(input.dataset.stockSelect);
      else state.selected.delete(input.dataset.stockSelect);
      render();
    }));
    view.querySelectorAll('[data-stock-details]').forEach(button => button.addEventListener('click', () => openDetails(button.dataset.stockDetails)));
    view.querySelectorAll('[data-stock-allocate]').forEach(button => button.addEventListener('click', () => openAllocateModal(new Set([button.dataset.stockAllocate]))));
    view.querySelector('[data-stock-bulk]')?.addEventListener('click', () => openAllocateModal(new Set(state.selected)));
    view.querySelector('[data-stock-add]')?.addEventListener('click', openManualModal);
    view.querySelector('[data-stock-scan]')?.addEventListener('click', openScanModal);
    const fileInput = view.querySelector('[data-stock-import-file]');
    view.querySelector('[data-stock-import]')?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', async e => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (file) await handleImportFile(file);
    });
    window.RRN_ICONS?.decorateStatic?.(view);
  }

  function toast(message) {
    document.getElementById('rrnStockToast')?.remove();
    const node = document.createElement('div');
    node.id = 'rrnStockToast';
    node.className = 'rrn-stock-toast';
    node.textContent = message;
    document.body.appendChild(node);
    setTimeout(() => node.remove(), 3200);
  }

  function createModal(id, content, wide = false) {
    document.getElementById(id)?.remove();
    const modal = document.createElement('div');
    modal.id = id;
    modal.className = 'rrn-stock-modal is-open';
    modal.innerHTML = `<div class="rrn-stock-dialog${wide ? ' wide' : ''}" role="dialog" aria-modal="true">${content}</div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(id); });
    modal.querySelectorAll('[data-modal-close]').forEach(button => button.addEventListener('click', () => closeModal(id)));
    return modal;
  }

  async function closeModal(id) {
    if (id === 'rrnStockScanModal') await stopStockScanner();
    document.getElementById(id)?.remove();
  }

  function typeOptions(selected = '') {
    const options = ['Notebook', 'Desktop', 'Workstation', 'Monitor', 'Impressora', 'Equipamento'];
    return options.map(value => `<option value="${value}" ${norm(value) === norm(selected) ? 'selected' : ''}>${value}</option>`).join('');
  }

  function openManualModal() {
    if (!canOperate()) return;
    const modal = createModal('rrnStockManualModal', `
      <div class="rrn-stock-dialog-head"><div><h3>Cadastrar no estoque</h3><p>Este equipamento entra diretamente no estoque da TI, sem setor e sem responsável.</p></div><button class="rrn-stock-close" data-modal-close aria-label="Fechar">×</button></div>
      <div class="rrn-stock-form-grid">
        <label class="rrn-stock-field full"><span>Tipo do equipamento</span><select data-manual-type>${typeOptions('Notebook')}</select></label>
        <label class="rrn-stock-field"><span>Patrimônio / etiqueta</span><input data-manual-patrimonio autocomplete="off" placeholder="Ex: 716594"></label>
        <label class="rrn-stock-field"><span>Número de série</span><input data-manual-serial autocomplete="off" placeholder="Ex: PE0E4AA3"></label>
        <label class="rrn-stock-field"><span>Fabricante (opcional)</span><input data-manual-maker placeholder="Ex: Dell"></label>
        <label class="rrn-stock-field"><span>Modelo (opcional)</span><input data-manual-model placeholder="Ex: Latitude 3420"></label>
      </div>
      <div class="rrn-stock-dialog-actions"><button data-modal-close>Cancelar</button><button class="primary" data-manual-save>Adicionar ao estoque</button></div>
    `);
    const save = () => {
      const data = {
        tipo: modal.querySelector('[data-manual-type]')?.value,
        patrimonio: modal.querySelector('[data-manual-patrimonio]')?.value?.trim(),
        serial: modal.querySelector('[data-manual-serial]')?.value?.trim(),
        fabricante: modal.querySelector('[data-manual-maker]')?.value?.trim(),
        modelo: modal.querySelector('[data-manual-model]')?.value?.trim()
      };
      if (!data.patrimonio && !data.serial) return alert('Informe o patrimônio/etiqueta ou o número de série.');
      const asset = makeAsset(data, 'manual');
      const duplicate = findDuplicate(asset);
      if (duplicate) return alert(`Este equipamento já está cadastrado em “${duplicate.where}”. Verifique patrimônio e número de série.`);
      const list = directStock();
      list.push(asset);
      writeDirectStock(list);
      closeModal('rrnStockManualModal');
      render();
      toast('Equipamento adicionado ao estoque.');
    };
    modal.querySelector('[data-manual-save]')?.addEventListener('click', save);
    modal.querySelector('[data-manual-serial]')?.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
    requestAnimationFrame(() => modal.querySelector('[data-manual-patrimonio]')?.focus());
  }

  function scanStatsHtml() {
    return `
      <div class="rrn-stock-scan-stat"><span>Lidos</span><strong data-scan-seen>${state.scan.seen}</strong></div>
      <div class="rrn-stock-scan-stat"><span>Adicionados</span><strong data-scan-added>${state.scan.added}</strong></div>
      <div class="rrn-stock-scan-stat"><span>Duplicados</span><strong data-scan-duplicates>${state.scan.duplicates}</strong></div>`;
  }

  function refreshScanStats(modal = document.getElementById('rrnStockScanModal')) {
    if (!modal) return;
    const values = { '[data-scan-seen]': state.scan.seen, '[data-scan-added]': state.scan.added, '[data-scan-duplicates]': state.scan.duplicates };
    Object.entries(values).forEach(([selector, value]) => { const el = modal.querySelector(selector); if (el) el.textContent = String(value); });
  }

  async function openScanModal() {
    if (!canOperate()) return;
    state.scan.seen = 0;
    state.scan.added = 0;
    state.scan.duplicates = 0;
    const modal = createModal('rrnStockScanModal', `
      <div class="rrn-stock-dialog-head"><div><h3>Leitura rápida de estoque</h3><p>Leia o código, informe o tipo e use “Adicionar e ler próximo”. Leitores USB/Bluetooth também podem digitar no campo de código.</p></div><button class="rrn-stock-close" data-modal-close aria-label="Fechar">×</button></div>
      <div class="rrn-stock-scan-stats">${scanStatsHtml()}</div>
      <div id="rrnStockReader" class="rrn-stock-reader"></div>
      <div class="rrn-stock-form-grid">
        <label class="rrn-stock-field"><span>O código lido representa</span><select data-scan-code-kind><option value="patrimonio">Patrimônio / etiqueta</option><option value="serial">Número de série</option></select></label>
        <label class="rrn-stock-field"><span>Código lido</span><input data-scan-code autocomplete="off" inputmode="text" placeholder="Aguardando leitura..."></label>
        <label class="rrn-stock-field full"><span>Tipo do equipamento</span><select data-scan-type>${typeOptions('Notebook')}</select></label>
        <label class="rrn-stock-field"><span>Fabricante (opcional)</span><input data-scan-maker placeholder="Ex: Dell"></label>
        <label class="rrn-stock-field"><span>Modelo (opcional)</span><input data-scan-model placeholder="Ex: Latitude 3420"></label>
      </div>
      <div class="rrn-stock-inline-note" data-scan-note>Aponte a câmera para o código de barras ou QR Code.</div>
      <div class="rrn-stock-dialog-actions"><button data-scan-retry>Ler novamente</button><button class="primary" data-scan-save>Adicionar e ler próximo</button></div>
    `, true);

    modal.querySelector('[data-scan-retry]')?.addEventListener('click', async () => {
      const code = modal.querySelector('[data-scan-code]');
      if (code) code.value = '';
      await startStockScanner();
    });
    modal.querySelector('[data-scan-save]')?.addEventListener('click', saveScannedAsset);
    modal.querySelector('[data-scan-code]')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); saveScannedAsset(); }
    });
    requestAnimationFrame(() => startStockScanner());
  }

  async function stopStockScanner() {
    const current = state.scan.instance;
    state.scan.instance = null;
    state.scan.starting = false;
    state.scan.locked = false;
    if (!current) return;
    try {
      const scannerState = typeof current.getState === 'function' ? current.getState() : null;
      if (scannerState == null || scannerState === 2 || scannerState === 3) await current.stop();
    } catch {}
    try { current.clear(); } catch {}
  }

  async function startStockScanner() {
    const modal = document.getElementById('rrnStockScanModal');
    if (!modal || state.scan.starting || state.scan.instance) return;
    const note = modal.querySelector('[data-scan-note]');
    if (!window.Html5Qrcode) {
      if (note) { note.textContent = 'A biblioteca do scanner não foi carregada. Você ainda pode usar um leitor USB/Bluetooth ou digitar o código.'; note.className = 'rrn-stock-inline-note warn'; }
      modal.querySelector('[data-scan-code]')?.focus();
      return;
    }

    state.scan.starting = true;
    state.scan.locked = false;
    if (note) { note.textContent = 'Abrindo câmera…'; note.className = 'rrn-stock-inline-note'; }

    try {
      const cameras = await window.Html5Qrcode.getCameras();
      if (!cameras?.length) throw new Error('Nenhuma câmera encontrada.');
      const preferred = cameras.find(camera => /back|rear|traseira|environment/i.test(camera.label || '')) || cameras[0];
      const reader = document.getElementById('rrnStockReader');
      if (reader) reader.innerHTML = '';
      const scanner = new window.Html5Qrcode('rrnStockReader');
      state.scan.instance = scanner;
      const formats = window.Html5QrcodeSupportedFormats ? [
        window.Html5QrcodeSupportedFormats.QR_CODE,
        window.Html5QrcodeSupportedFormats.CODE_128,
        window.Html5QrcodeSupportedFormats.CODE_39,
        window.Html5QrcodeSupportedFormats.EAN_13,
        window.Html5QrcodeSupportedFormats.EAN_8,
        window.Html5QrcodeSupportedFormats.UPC_A,
        window.Html5QrcodeSupportedFormats.UPC_E
      ].filter(value => value != null) : undefined;

      await scanner.start(
        { deviceId: { exact: preferred.id } },
        { fps: 10, qrbox: { width: 270, height: 170 }, formatsToSupport: formats },
        async decodedText => {
          if (state.scan.locked) return;
          state.scan.locked = true;
          state.scan.seen += 1;
          refreshScanStats(modal);
          const input = modal.querySelector('[data-scan-code]');
          if (input) input.value = String(decodedText || '').trim();
          if (note) { note.textContent = `Código lido: ${decodedText}. Escolha/confirme o tipo e adicione ao estoque.`; note.className = 'rrn-stock-inline-note ok'; }
          await stopStockScanner();
          requestAnimationFrame(() => modal.querySelector('[data-scan-type]')?.focus());
        },
        () => undefined
      );
    } catch (error) {
      console.warn('RRN estoque: scanner indisponível.', error);
      if (note) { note.textContent = `${error?.message || 'Não foi possível abrir a câmera.'} Você pode digitar o código ou usar leitor USB/Bluetooth.`; note.className = 'rrn-stock-inline-note warn'; }
      modal.querySelector('[data-scan-code]')?.focus();
      state.scan.instance = null;
    } finally {
      state.scan.starting = false;
    }
  }

  async function saveScannedAsset() {
    const modal = document.getElementById('rrnStockScanModal');
    if (!modal) return;
    const code = modal.querySelector('[data-scan-code]')?.value?.trim() || '';
    if (!code) return alert('Leia ou informe um código antes de adicionar.');
    const kind = modal.querySelector('[data-scan-code-kind]')?.value || 'patrimonio';
    const data = {
      tipo: modal.querySelector('[data-scan-type]')?.value || 'Equipamento',
      patrimonio: kind === 'patrimonio' ? code : '',
      serial: kind === 'serial' ? code : '',
      fabricante: modal.querySelector('[data-scan-maker]')?.value?.trim() || '',
      modelo: modal.querySelector('[data-scan-model]')?.value?.trim() || ''
    };
    const asset = makeAsset(data, 'scanner');
    const duplicate = findDuplicate(asset);
    const note = modal.querySelector('[data-scan-note]');
    if (duplicate) {
      state.scan.duplicates += 1;
      refreshScanStats(modal);
      if (note) { note.textContent = `Duplicado: ${code} já está em “${duplicate.where}”. Nenhum cadastro foi criado.`; note.className = 'rrn-stock-inline-note warn'; }
      return;
    }

    const list = directStock();
    list.push(asset);
    writeDirectStock(list);
    state.scan.added += 1;
    refreshScanStats(modal);
    const codeInput = modal.querySelector('[data-scan-code]');
    if (codeInput) codeInput.value = '';
    const maker = modal.querySelector('[data-scan-maker]');
    const model = modal.querySelector('[data-scan-model]');
    if (maker) maker.value = '';
    if (model) model.value = '';
    if (note) { note.textContent = `${code} adicionado. Preparando a próxima leitura…`; note.className = 'rrn-stock-inline-note ok'; }
    render();
    await stopStockScanner();
    setTimeout(() => startStockScanner(), 260);
  }

  function parseCsv(text) {
    const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
    if (!lines.length) return [];
    const first = lines[0];
    const candidates = [',', ';', '\t'];
    const separator = candidates.sort((a, b) => (first.split(b).length - first.split(a).length))[0];
    const parseLine = line => {
      const values = [];
      let current = '';
      let quoted = false;
      for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        if (ch === '"') {
          if (quoted && line[i + 1] === '"') { current += '"'; i += 1; }
          else quoted = !quoted;
        } else if (ch === separator && !quoted) {
          values.push(current.trim());
          current = '';
        } else current += ch;
      }
      values.push(current.trim());
      return values;
    };
    const headers = parseLine(lines[0]);
    return lines.slice(1).map(line => {
      const values = parseLine(line);
      const row = {};
      headers.forEach((header, index) => { row[header] = values[index] ?? ''; });
      return row;
    });
  }

  function pick(row, aliases) {
    const entries = Object.entries(row || {});
    for (const alias of aliases) {
      const wanted = fold(alias);
      const found = entries.find(([key]) => fold(key) === wanted);
      if (found && String(found[1] ?? '').trim()) return String(found[1]).trim();
    }
    return '';
  }

  function mapImportRows(rows) {
    const valid = [];
    const duplicates = [];
    const invalid = [];
    const accepted = [];
    (Array.isArray(rows) ? rows : []).forEach((row, index) => {
      const data = {
        patrimonio: pick(row, ['patrimonio', 'patrimônio', 'etiqueta', 'tag', 'asset tag', 'asset_tag']),
        serial: pick(row, ['serial', 'numero serie', 'número de série', 'numero de serie', 'sn', 'service tag', 'service_tag']),
        tipo: pick(row, ['tipo', 'tipo equipamento', 'equipamento', 'categoria']) || 'Equipamento',
        fabricante: pick(row, ['fabricante', 'marca', 'manufacturer']),
        modelo: pick(row, ['modelo', 'model'])
      };
      if (!data.patrimonio && !data.serial) {
        invalid.push({ index: index + 2, reason: 'Sem patrimônio e sem número de série' });
        return;
      }
      const asset = makeAsset(data, 'importacao');
      const duplicate = findDuplicate(asset, accepted);
      if (duplicate) {
        duplicates.push({ index: index + 2, asset, where: duplicate.where });
        return;
      }
      accepted.push(asset);
      valid.push(asset);
    });
    return { valid, duplicates, invalid };
  }

  function loadXlsxLibrary() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-rrn-xlsx]');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.XLSX), { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      script.async = true;
      script.dataset.rrnXlsx = '1';
      script.onload = () => resolve(window.XLSX);
      script.onerror = () => reject(new Error('Não foi possível carregar o leitor de Excel.'));
      document.head.appendChild(script);
    });
  }

  async function handleImportFile(file) {
    try {
      let rows = [];
      if (/\.csv$/i.test(file.name) || /csv/i.test(file.type)) {
        rows = parseCsv(await file.text());
      } else {
        const XLSX = await loadXlsxLibrary();
        if (!XLSX) throw new Error('Leitor de Excel indisponível.');
        const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
      }
      const result = mapImportRows(rows);
      state.importRows = result.valid;
      openImportPreview(file.name, result);
    } catch (error) {
      console.error('RRN estoque: falha ao importar planilha.', error);
      alert(error?.message || 'Não foi possível ler o arquivo.');
    }
  }

  function openImportPreview(filename, result) {
    const preview = result.valid.slice(0, 12);
    const modal = createModal('rrnStockImportModal', `
      <div class="rrn-stock-dialog-head"><div><h3>Importar para o estoque</h3><p>${esc(filename)} · os itens válidos entrarão sem setor e sem responsável.</p></div><button class="rrn-stock-close" data-modal-close aria-label="Fechar">×</button></div>
      <div class="rrn-stock-import-summary">
        <article><span>Prontos</span><strong>${result.valid.length}</strong></article>
        <article><span>Duplicados</span><strong>${result.duplicates.length}</strong></article>
        <article><span>Ignorados</span><strong>${result.invalid.length}</strong></article>
      </div>
      <div class="rrn-stock-preview">
        ${preview.length ? preview.map(asset => `<div class="rrn-stock-preview-row"><strong>${esc(assetLabel(asset))}</strong><span>${esc(typeLabel(asset))}</span><span>${esc(serialLabel(asset))}</span></div>`).join('') : '<div class="rrn-stock-empty"><strong>Nenhuma linha válida encontrada</strong></div>'}
      </div>
      ${result.valid.length > preview.length ? `<div class="rrn-stock-inline-note">Mostrando 12 de ${result.valid.length} equipamentos prontos para importar.</div>` : ''}
      ${result.duplicates.length ? `<div class="rrn-stock-inline-note warn">${result.duplicates.length} linha(s) duplicada(s) serão ignoradas automaticamente.</div>` : ''}
      <div class="rrn-stock-dialog-actions"><button data-modal-close>Cancelar</button><button class="primary" data-import-confirm ${result.valid.length ? '' : 'disabled'}>Importar ${result.valid.length} equipamento(s)</button></div>
    `, true);
    modal.querySelector('[data-import-confirm]')?.addEventListener('click', () => {
      if (!state.importRows.length) return;
      const list = directStock();
      list.push(...state.importRows);
      writeDirectStock(list);
      const count = state.importRows.length;
      state.importRows = [];
      closeModal('rrnStockImportModal');
      render();
      toast(`${count} equipamento(s) importado(s) para o estoque.`);
    });
  }

  function openDetails(key) {
    const row = stockRecords().find(item => item.key === key);
    if (!row) return alert('Equipamento não encontrado.');
    if (row.source === 'sector' && Number.isInteger(row.sectorIndex) && Number.isInteger(row.assetIndex)) {
      window.showInfo?.(row.sectorIndex, row.assetIndex);
      return;
    }
    const asset = row.asset;
    createModal('rrnStockDetailsModal', `
      <div class="rrn-stock-dialog-head"><div><h3>${esc(assetLabel(asset))}</h3><p>Equipamento armazenado diretamente no estoque da TI.</p></div><button class="rrn-stock-close" data-modal-close aria-label="Fechar">×</button></div>
      <div class="rrn-stock-form-grid">
        <label class="rrn-stock-field"><span>Tipo</span><input value="${esc(typeLabel(asset))}" disabled></label>
        <label class="rrn-stock-field"><span>Patrimônio</span><input value="${esc(asset.etiqueta || asset.patrimonio || '—')}" disabled></label>
        <label class="rrn-stock-field"><span>Número de série</span><input value="${esc(serialLabel(asset))}" disabled></label>
        <label class="rrn-stock-field"><span>Fabricante / modelo</span><input value="${esc(modelLabel(asset))}" disabled></label>
      </div>
      <div class="rrn-stock-dialog-actions"><button data-modal-close>Fechar</button>${canOperate() ? `<button class="primary" data-detail-allocate>Alocar</button>` : ''}</div>
    `).querySelector('[data-detail-allocate]')?.addEventListener('click', () => {
      closeModal('rrnStockDetailsModal');
      openAllocateModal(new Set([key]));
    });
  }

  let allocationKeys = new Set();

  function openAllocateModal(keys) {
    if (!canOperate() || !keys?.size) return;
    allocationKeys = new Set(keys);
    const list = inventory();
    if (!list.length) return alert('Cadastre pelo menos um setor antes de alocar equipamentos.');
    const modal = createModal('rrnStockAllocateModal', `
      <div class="rrn-stock-dialog-head"><div><h3>Alocar equipamento</h3><p>${allocationKeys.size === 1 ? 'Escolha o setor de destino e, se quiser, informe o responsável.' : `${allocationKeys.size} equipamentos serão alocados para o mesmo setor.`}</p></div><button class="rrn-stock-close" data-modal-close aria-label="Fechar">×</button></div>
      <label class="rrn-stock-field"><span>Setor de destino</span><select data-stock-sector><option value="">Selecione o setor</option>${list.map((sector, index) => `<option value="${index}">${esc(sector?.nome || `Setor ${index + 1}`)}</option>`).join('')}</select></label>
      <label class="rrn-stock-field"><span>Responsável (opcional)</span><input data-stock-responsible type="text" placeholder="Nome do colaborador"></label>
      <div class="rrn-stock-dialog-actions"><button data-modal-close>Cancelar</button><button class="primary" data-stock-confirm>Confirmar alocação</button></div>
    `);
    modal.querySelector('[data-stock-confirm]')?.addEventListener('click', confirmAllocation);
    requestAnimationFrame(() => modal.querySelector('[data-stock-sector]')?.focus());
  }

  function confirmAllocation() {
    const modal = document.getElementById('rrnStockAllocateModal');
    if (!modal) return;
    const raw = modal.querySelector('[data-stock-sector]')?.value ?? '';
    const destinationIndex = Number(raw);
    if (raw === '' || Number.isNaN(destinationIndex)) return alert('Selecione o setor de destino.');
    const responsible = modal.querySelector('[data-stock-responsible]')?.value?.trim() || '';
    const sectorsList = inventory();
    const destination = sectorsList[destinationIndex];
    if (!destination) return alert('Setor de destino não encontrado.');
    if (!Array.isArray(destination.maquinas)) destination.maquinas = [];

    const current = stockRecords().filter(row => allocationKeys.has(row.key));
    if (!current.length) return alert('Os equipamentos selecionados não estão mais disponíveis no estoque.');

    const direct = directStock();
    const directIdsToRemove = new Set();
    const legacyGroups = new Map();
    const moved = [];

    current.forEach(row => {
      if (row.source === 'direct') {
        const asset = row.asset;
        asset.situacaoPatrimonial = 'ativo';
        asset.usuarioResponsavel = responsible;
        asset.atualizadoEm = nowIso();
        destination.maquinas.push(asset);
        directIdsToRemove.add(String(asset.id));
        moved.push(asset);
      } else {
        if (!legacyGroups.has(row.sectorIndex)) legacyGroups.set(row.sectorIndex, []);
        legacyGroups.get(row.sectorIndex).push(row);
      }
    });

    legacyGroups.forEach((rows, sourceIndex) => {
      const source = sectorsList[sourceIndex];
      if (!source || !Array.isArray(source.maquinas)) return;
      rows.sort((a, b) => b.assetIndex - a.assetIndex).forEach(row => {
        const asset = source.maquinas[row.assetIndex];
        if (!asset) return;
        asset.situacaoPatrimonial = 'ativo';
        asset.usuarioResponsavel = responsible;
        asset.atualizadoEm = nowIso();
        if (sourceIndex !== destinationIndex) {
          source.maquinas.splice(row.assetIndex, 1);
          destination.maquinas.push(asset);
        }
        moved.push(asset);
      });
    });

    if (!moved.length) return alert('Nenhum equipamento pôde ser alocado.');

    const nextDirect = direct.filter(asset => !directIdsToRemove.has(String(asset.id)));
    try {
      writeDirectStock(nextDirect);
      persistInventory();
    } catch (error) {
      console.error('RRN Manager: falha ao salvar alocação.', error);
      return alert('Não foi possível salvar a alocação. Atualize a página e tente novamente.');
    }

    state.selected.clear();
    allocationKeys.clear();
    closeModal('rrnStockAllocateModal');
    try { window.renderSetores?.(document.getElementById('searchInput')?.value?.trim().toLowerCase() || null); } catch {}
    window.RRN_UI?.updateOverview?.();
    window.RRN_TABS?.renderHome?.();
    render();
    toast(`${moved.length} equipamento(s) alocado(s) com sucesso.`);
  }

  function installObservers() {
    window.addEventListener('storage', e => {
      if ((e.key === 'setores' || e.key === STOCK_KEY) && document.body.classList.contains('rrn-tab-stock')) render();
    });
    window.addEventListener('rrn:stock-update', () => { if (document.body.classList.contains('rrn-tab-stock')) render(); });
    window.addEventListener('rrn:inventory-remote-update', () => { if (document.body.classList.contains('rrn-tab-stock')) render(); });
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      const open = document.querySelector('.rrn-stock-modal.is-open');
      if (open) closeModal(open.id);
    });
  }

  function boot() {
    ensureStyle();
    ensureView();
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      ensureTab();
      if (document.querySelector('[data-app-tab="stock"]') || tries > 80) {
        clearInterval(timer);
        if (['#stock', '#estoque'].includes(location.hash.toLowerCase())) openStockTab();
      }
    }, 50);
    installObservers();
  }

  window.RRN_STOCK = Object.freeze({
    open: openStockTab,
    render,
    add: openManualModal,
    scan: openScanModal,
    key: STOCK_KEY
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();