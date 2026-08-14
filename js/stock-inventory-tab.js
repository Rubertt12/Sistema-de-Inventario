(() => {
  'use strict';
  if (window.__RRN_STOCK_INVENTORY_TAB__) return;
  window.__RRN_STOCK_INVENTORY_TAB__ = true;

  const state = { query: '', type: 'all', selected: new Set() };

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const norm = value => String(value ?? '').trim().toLowerCase();

  function inventory() {
    try { if (typeof setores !== 'undefined' && Array.isArray(setores)) return setores; } catch {}
    try {
      const parsed = JSON.parse(localStorage.getItem('setores') || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  function canOperate() {
    const role = window.RRN_SESSION?.role || (() => {
      try { return JSON.parse(localStorage.getItem('usuarioLogado') || '{}').perfil; } catch { return null; }
    })();
    return role == null || role === 'admin' || role === 'operador';
  }

  function typeLabel(asset) {
    return String(asset?.tipoMaquina || asset?.tipo || 'Equipamento').trim() || 'Equipamento';
  }

  function assetLabel(asset) {
    return String(asset?.etiqueta || asset?.nome || asset?.numeroSerie || asset?.serial || 'Sem identificação').trim();
  }

  function serialLabel(asset) {
    return String(asset?.nome || asset?.numeroSerie || asset?.serial || asset?.serviceTag || '—').trim();
  }

  function recordKey(sectorIndex, assetIndex, asset) {
    const id = String(asset?.id ?? '').trim();
    if (id) return `id:${id}`;
    return `slot:${sectorIndex}:${assetIndex}:${norm(asset?.etiqueta)}:${norm(asset?.nome)}`;
  }

  function stockRecords() {
    const rows = [];
    inventory().forEach((sector, sectorIndex) => {
      (Array.isArray(sector?.maquinas) ? sector.maquinas : []).forEach((asset, assetIndex) => {
        const status = norm(asset?.situacaoPatrimonial);
        if (!status.includes('estoque')) return;
        if (asset?.emManutencao) return;
        if (norm(asset?.usuarioResponsavel)) return;
        rows.push({
          asset,
          sectorIndex,
          assetIndex,
          sectorName: sector?.nome || `Setor ${sectorIndex + 1}`,
          key: recordKey(sectorIndex, assetIndex, asset)
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
        row.asset?.etiqueta, row.asset?.nome, row.asset?.numeroSerie, row.asset?.serial,
        row.asset?.serviceTag, row.asset?.fabricante, row.asset?.modelo, typeLabel(row.asset), row.sectorName
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
    return [...map.entries()].sort((a,b) => b[1] - a[1]);
  }

  function ensureStyle() {
    if (document.getElementById('rrn-stock-tab-style')) return;
    const style = document.createElement('style');
    style.id = 'rrn-stock-tab-style';
    style.textContent = `
      .rrn-app-tab[data-app-tab="stock"]{font-size:0!important}.rrn-app-tab[data-app-tab="stock"]::after{content:"Máquinas em estoque";font-size:.72rem}
      body.rrn-tab-stock .rrn-dashboard-home,body.rrn-tab-stock>main,body.rrn-tab-stock .dashboard-actions{display:none!important}body.rrn-tab-stock #searchInput{display:none!important}
      .rrn-stock-view{display:none;width:calc(100% - clamp(32px,4vw,72px));margin:22px auto 34px;color:var(--rrn-text,#263238)}body.rrn-tab-stock .rrn-stock-view{display:block}
      .rrn-stock-hero{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:22px 24px;border:1px solid var(--rrn-border,rgba(22,58,77,.14));border-left:5px solid var(--rrn-secondary,#2F7D78);border-radius:17px;background:var(--rrn-surface,#fff);box-shadow:0 9px 28px rgba(22,58,77,.07)}
      .rrn-stock-eyebrow{display:block;margin-bottom:5px;color:var(--rrn-secondary,#2F7D78);font-size:.66rem;font-weight:850;letter-spacing:.09em;text-transform:uppercase}.rrn-stock-hero h2{margin:0!important;color:var(--rrn-heading,#163A4D)!important;font:750 clamp(1.35rem,2.3vw,2rem)/1.15 Manrope,Inter,sans-serif!important;text-align:left!important}.rrn-stock-hero p{max-width:760px;margin:7px 0 0;color:var(--rrn-muted,#66757F);font-size:.78rem;line-height:1.5}.rrn-stock-total{flex:0 0 auto;min-width:130px;padding:12px 15px;border:1px solid var(--rrn-border,rgba(22,58,77,.12));border-radius:13px;background:var(--rrn-surface-2,#f5f8f9);text-align:right}.rrn-stock-total span,.rrn-stock-total strong{display:block}.rrn-stock-total span{color:var(--rrn-muted,#66757F);font-size:.62rem;font-weight:800;text-transform:uppercase}.rrn-stock-total strong{margin-top:4px;color:var(--rrn-heading,#163A4D);font-size:1.75rem;line-height:1}
      .rrn-stock-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:13px 0}.rrn-stock-kpi{padding:14px;border:1px solid var(--rrn-border,rgba(22,58,77,.12));border-radius:13px;background:var(--rrn-surface,#fff)}.rrn-stock-kpi span,.rrn-stock-kpi strong{display:block}.rrn-stock-kpi span{overflow:hidden;color:var(--rrn-muted,#66757F);font-size:.64rem;font-weight:700;text-overflow:ellipsis;white-space:nowrap}.rrn-stock-kpi strong{margin-top:6px;color:var(--rrn-heading,#163A4D);font-size:1.25rem}
      .rrn-stock-panel{padding:18px;border:1px solid var(--rrn-border,rgba(22,58,77,.14));border-radius:16px;background:var(--rrn-surface,#fff);box-shadow:0 8px 25px rgba(22,58,77,.05)}.rrn-stock-toolbar{display:grid;grid-template-columns:minmax(220px,1fr) 190px auto;gap:10px;align-items:center;margin-bottom:14px}.rrn-stock-toolbar input,.rrn-stock-toolbar select{width:100%;min-height:42px;padding:9px 11px;border:1px solid var(--rrn-border,rgba(22,58,77,.16));border-radius:10px;background:var(--rrn-surface,#fff);color:var(--rrn-text,#263238);font:600 .72rem Inter,sans-serif;outline:none}.rrn-stock-toolbar input:focus,.rrn-stock-toolbar select:focus{border-color:var(--rrn-secondary,#2F7D78);box-shadow:0 0 0 3px color-mix(in srgb,var(--rrn-secondary,#2F7D78) 12%,transparent)}.rrn-stock-bulk{min-height:42px;padding:0 14px;border:1px solid var(--rrn-secondary,#2F7D78);border-radius:10px;background:var(--rrn-secondary,#2F7D78);color:#fff;font:800 .7rem Inter,sans-serif;cursor:pointer}.rrn-stock-bulk:disabled{opacity:.45;cursor:not-allowed}
      .rrn-stock-list{display:flex;flex-direction:column;gap:8px}.rrn-stock-row{display:grid;grid-template-columns:30px minmax(160px,1.25fr) minmax(120px,.7fr) minmax(140px,.8fr) minmax(120px,.7fr) auto;gap:12px;align-items:center;padding:12px 13px;border:1px solid var(--rrn-border,rgba(22,58,77,.1));border-radius:12px;background:var(--rrn-surface-2,#f7f9f9)}.rrn-stock-row:hover{border-color:color-mix(in srgb,var(--rrn-secondary,#2F7D78) 35%,var(--rrn-border,transparent))}.rrn-stock-check{display:grid;place-items:center}.rrn-stock-check input{width:16px;height:16px;accent-color:var(--rrn-secondary,#2F7D78)}.rrn-stock-main strong,.rrn-stock-main small,.rrn-stock-meta strong,.rrn-stock-meta small{display:block}.rrn-stock-main strong{overflow:hidden;color:var(--rrn-heading,#163A4D);font-size:.76rem;text-overflow:ellipsis;white-space:nowrap}.rrn-stock-main small,.rrn-stock-meta small{margin-top:3px;color:var(--rrn-muted,#66757F);font-size:.61rem}.rrn-stock-meta strong{overflow:hidden;color:var(--rrn-text,#263238);font-size:.68rem;text-overflow:ellipsis;white-space:nowrap}.rrn-stock-status{display:inline-flex;width:max-content;margin-top:4px;padding:3px 7px;border-radius:999px;background:color-mix(in srgb,var(--rrn-secondary,#2F7D78) 12%,transparent);color:var(--rrn-secondary,#2F7D78);font-size:.57rem;font-weight:850}.rrn-stock-actions{display:flex;gap:6px;justify-content:flex-end}.rrn-stock-actions button{min-height:34px;padding:0 10px;border:1px solid var(--rrn-border,rgba(22,58,77,.14));border-radius:8px;background:var(--rrn-surface,#fff);color:var(--rrn-heading,#163A4D);font:800 .63rem Inter,sans-serif;cursor:pointer}.rrn-stock-actions button.primary{border-color:var(--rrn-secondary,#2F7D78);background:var(--rrn-secondary,#2F7D78);color:#fff}.rrn-stock-empty{padding:42px 18px;border:1px dashed var(--rrn-border,rgba(22,58,77,.15));border-radius:13px;text-align:center;color:var(--rrn-muted,#66757F)}.rrn-stock-empty strong,.rrn-stock-empty small{display:block}.rrn-stock-empty strong{color:var(--rrn-heading,#163A4D);font-size:.86rem}.rrn-stock-empty small{margin-top:5px;font-size:.7rem}
      .rrn-stock-modal{position:fixed;inset:0;z-index:32000;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(5,18,25,.68);backdrop-filter:blur(8px)}.rrn-stock-modal.is-open{display:flex}.rrn-stock-dialog{width:min(520px,100%);max-height:calc(100dvh - 32px);overflow:auto;padding:20px;border:1px solid var(--rrn-border,rgba(22,58,77,.14));border-radius:17px;background:var(--rrn-surface,#fff);color:var(--rrn-text,#263238);box-shadow:0 25px 75px rgba(0,0,0,.35)}.rrn-stock-dialog-head{display:flex;align-items:flex-start;justify-content:space-between;gap:15px;margin-bottom:16px}.rrn-stock-dialog h3{margin:0;color:var(--rrn-heading,#163A4D);font-size:1.05rem}.rrn-stock-dialog p{margin:5px 0 0;color:var(--rrn-muted,#66757F);font-size:.7rem;line-height:1.45}.rrn-stock-close{display:grid;place-items:center;width:36px;height:36px;border:0;border-radius:9px;background:var(--rrn-heading,#163A4D);color:#fff;font-size:1.15rem;cursor:pointer}.rrn-stock-field{display:block;margin-top:12px}.rrn-stock-field span{display:block;margin-bottom:6px;color:var(--rrn-heading,#163A4D);font-size:.68rem;font-weight:800}.rrn-stock-field input,.rrn-stock-field select{width:100%;min-height:43px;padding:9px 11px;border:1px solid var(--rrn-border,rgba(22,58,77,.15));border-radius:9px;background:var(--rrn-surface-2,#f7f9f9);color:var(--rrn-text,#263238)}.rrn-stock-dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}.rrn-stock-dialog-actions button{min-height:39px;padding:0 13px;border:1px solid var(--rrn-border,rgba(22,58,77,.15));border-radius:9px;background:var(--rrn-surface-2,#f7f9f9);color:var(--rrn-heading,#163A4D);font-weight:800;cursor:pointer}.rrn-stock-dialog-actions button.primary{border-color:var(--rrn-secondary,#2F7D78);background:var(--rrn-secondary,#2F7D78);color:#fff}
      :root[data-theme="dark"] .rrn-stock-view{color:#E7EEF0}:root[data-theme="dark"] .rrn-stock-row,:root[data-theme="dark"] .rrn-stock-kpi,:root[data-theme="dark"] .rrn-stock-panel,:root[data-theme="dark"] .rrn-stock-hero,:root[data-theme="dark"] .rrn-stock-dialog{border-color:rgba(180,205,214,.12)}
      @media(max-width:1000px){.rrn-stock-row{grid-template-columns:28px minmax(150px,1.2fr) minmax(110px,.7fr) minmax(120px,.8fr) auto}.rrn-stock-row .rrn-stock-meta:nth-of-type(4){display:none}}
      @media(max-width:700px){.rrn-stock-view{width:calc(100% - 16px);margin:14px 8px 26px}.rrn-stock-hero{padding:17px;flex-direction:column}.rrn-stock-total{width:100%;display:flex;align-items:center;justify-content:space-between;text-align:left}.rrn-stock-total strong{margin:0}.rrn-stock-kpis{grid-template-columns:1fr 1fr}.rrn-stock-panel{padding:12px}.rrn-stock-toolbar{grid-template-columns:1fr}.rrn-stock-bulk{width:100%}.rrn-stock-row{position:relative;grid-template-columns:26px minmax(0,1fr);gap:8px 10px;padding:12px}.rrn-stock-main{padding-right:4px}.rrn-stock-meta{grid-column:2}.rrn-stock-row .rrn-stock-meta:nth-of-type(4){display:block}.rrn-stock-actions{grid-column:1/-1;justify-content:stretch;margin-top:3px}.rrn-stock-actions button{flex:1}.rrn-stock-check{grid-row:1/5;align-self:start;padding-top:2px}.rrn-app-tab[data-app-tab="stock"]::after{content:"Estoque"}}
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

  function ensureModal() {
    let modal = document.getElementById('rrnStockAllocateModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'rrnStockAllocateModal';
    modal.className = 'rrn-stock-modal';
    modal.innerHTML = `
      <div class="rrn-stock-dialog" role="dialog" aria-modal="true" aria-labelledby="rrnStockAllocateTitle">
        <div class="rrn-stock-dialog-head"><div><h3 id="rrnStockAllocateTitle">Alocar equipamento</h3><p data-stock-modal-copy>Escolha o setor de destino e, se quiser, já informe o colaborador responsável.</p></div><button type="button" class="rrn-stock-close" data-stock-close aria-label="Fechar">×</button></div>
        <label class="rrn-stock-field"><span>Setor de destino</span><select data-stock-sector></select></label>
        <label class="rrn-stock-field"><span>Responsável (opcional)</span><input data-stock-responsible type="text" placeholder="Nome do colaborador"></label>
        <div class="rrn-stock-dialog-actions"><button type="button" data-stock-cancel>Cancelar</button><button type="button" class="primary" data-stock-confirm>Confirmar alocação</button></div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector('[data-stock-close]')?.addEventListener('click', closeAllocateModal);
    modal.querySelector('[data-stock-cancel]')?.addEventListener('click', closeAllocateModal);
    modal.addEventListener('click', e => { if (e.target === modal) closeAllocateModal(); });
    modal.querySelector('[data-stock-confirm]')?.addEventListener('click', confirmAllocation);
    return modal;
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
      existing.addEventListener('click', () => closeStockMode(), true);
    });
    window.RRN_ICONS?.decorateStatic?.(button);
  }

  function closeStockMode() {
    document.body.classList.remove('rrn-tab-stock');
    document.querySelector('[data-app-tab="stock"]')?.classList.remove('is-active');
    document.querySelector('[data-app-tab="stock"]')?.setAttribute('aria-selected','false');
  }

  function openStockTab() {
    ensureTab();
    ensureView();
    document.body.classList.remove('rrn-tab-dashboard','rrn-tab-inventory');
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
    const top = buckets.slice(0,4);
    while (top.length < 4) top.push(['—',0]);

    // Remove seleções que não existem mais.
    const valid = new Set(all.map(row => row.key));
    [...state.selected].forEach(key => { if (!valid.has(key)) state.selected.delete(key); });

    const types = [...new Set(all.map(row => typeLabel(row.asset)))].sort((a,b) => a.localeCompare(b,'pt-BR'));
    view.innerHTML = `
      <section class="rrn-stock-hero">
        <div><span class="rrn-stock-eyebrow">Estoque da TI</span><h2>Máquinas em estoque</h2><p>Equipamentos recebidos e disponíveis, ainda sem colaborador responsável. Ao alocar, o ativo sai automaticamente desta fila e volta ao inventário operacional.</p></div>
        <div class="rrn-stock-total"><span>Total disponível</span><strong>${all.length}</strong></div>
      </section>
      <section class="rrn-stock-kpis">${top.map(([label,count]) => `<article class="rrn-stock-kpi"><span>${esc(label)}</span><strong>${count}</strong></article>`).join('')}</section>
      <section class="rrn-stock-panel">
        <div class="rrn-stock-toolbar">
          <input type="search" data-stock-search placeholder="Pesquisar patrimônio, série, modelo..." value="${esc(state.query)}">
          <select data-stock-type><option value="all">Todos os tipos</option>${types.map(type => `<option value="${esc(norm(type))}" ${state.type===norm(type)?'selected':''}>${esc(type)}</option>`).join('')}</select>
          <button type="button" class="rrn-stock-bulk" data-stock-bulk ${!state.selected.size || !canOperate() ? 'disabled':''}>Alocar selecionadas (${state.selected.size})</button>
        </div>
        <div class="rrn-stock-list">
          ${rows.length ? rows.map(row => {
            const asset = row.asset;
            return `<article class="rrn-stock-row" data-stock-key="${esc(row.key)}">
              <label class="rrn-stock-check"><input type="checkbox" data-stock-select="${esc(row.key)}" ${state.selected.has(row.key)?'checked':''} ${!canOperate()?'disabled':''}></label>
              <div class="rrn-stock-main"><strong>${esc(assetLabel(asset))}</strong><small>${esc([asset.fabricante,asset.modelo].filter(Boolean).join(' ') || typeLabel(asset))}</small><span class="rrn-stock-status">Em estoque</span></div>
              <div class="rrn-stock-meta"><small>Tipo</small><strong>${esc(typeLabel(asset))}</strong></div>
              <div class="rrn-stock-meta"><small>Nº de série</small><strong>${esc(serialLabel(asset))}</strong></div>
              <div class="rrn-stock-meta"><small>Local atual</small><strong>${esc(row.sectorName)}</strong></div>
              <div class="rrn-stock-actions"><button type="button" data-stock-details="${row.sectorIndex}:${row.assetIndex}">Detalhes</button>${canOperate()?`<button type="button" class="primary" data-stock-allocate="${esc(row.key)}">Alocar</button>`:''}</div>
            </article>`;
          }).join('') : '<div class="rrn-stock-empty"><strong>Nenhum equipamento em estoque</strong><small>Ativos com situação patrimonial “Em estoque” e sem responsável aparecerão aqui automaticamente.</small></div>'}
        </div>
      </section>`;

    view.querySelector('[data-stock-search]')?.addEventListener('input', e => { state.query = norm(e.target.value); render(); requestAnimationFrame(() => view.querySelector('[data-stock-search]')?.focus()); });
    view.querySelector('[data-stock-type]')?.addEventListener('change', e => { state.type = e.target.value; render(); });
    view.querySelectorAll('[data-stock-select]').forEach(input => input.addEventListener('change', () => {
      if (input.checked) state.selected.add(input.dataset.stockSelect); else state.selected.delete(input.dataset.stockSelect);
      render();
    }));
    view.querySelectorAll('[data-stock-details]').forEach(button => button.addEventListener('click', () => {
      const [sectorIndex, assetIndex] = button.dataset.stockDetails.split(':').map(Number);
      window.showInfo?.(sectorIndex, assetIndex);
    }));
    view.querySelectorAll('[data-stock-allocate]').forEach(button => button.addEventListener('click', () => openAllocateModal(new Set([button.dataset.stockAllocate]))));
    view.querySelector('[data-stock-bulk]')?.addEventListener('click', () => openAllocateModal(new Set(state.selected)));
    window.RRN_ICONS?.decorateStatic?.(view);
  }

  let allocationKeys = new Set();

  function openAllocateModal(keys) {
    if (!canOperate() || !keys?.size) return;
    allocationKeys = new Set(keys);
    const modal = ensureModal();
    const select = modal.querySelector('[data-stock-sector]');
    const responsible = modal.querySelector('[data-stock-responsible]');
    const copy = modal.querySelector('[data-stock-modal-copy]');
    const list = inventory();
    select.innerHTML = '<option value="">Selecione o setor</option>' + list.map((sector,index) => `<option value="${index}">${esc(sector?.nome || `Setor ${index+1}`)}</option>`).join('');
    if (responsible) responsible.value = '';
    if (copy) copy.textContent = allocationKeys.size === 1 ? 'Escolha o setor de destino e, se quiser, já informe o colaborador responsável.' : `${allocationKeys.size} equipamentos serão alocados para o mesmo setor.`;
    modal.classList.add('is-open');
    requestAnimationFrame(() => select?.focus());
  }

  function closeAllocateModal() {
    document.getElementById('rrnStockAllocateModal')?.classList.remove('is-open');
    allocationKeys = new Set();
  }

  function persist() {
    try {
      if (typeof window.saveSetoresAndMachines === 'function') window.saveSetoresAndMachines();
      else localStorage.setItem('setores', JSON.stringify(inventory()));
      return true;
    } catch (error) {
      console.error('RRN Manager: falha ao salvar alocação de estoque.', error);
      alert('Não foi possível salvar a alocação. Tente novamente.');
      return false;
    }
  }

  function confirmAllocation() {
    const modal = ensureModal();
    const destinationIndex = Number(modal.querySelector('[data-stock-sector]')?.value);
    const rawValue = modal.querySelector('[data-stock-sector]')?.value;
    if (rawValue === '' || Number.isNaN(destinationIndex)) return alert('Selecione o setor de destino.');
    const responsible = modal.querySelector('[data-stock-responsible]')?.value?.trim() || '';
    const list = inventory();
    const destination = list[destinationIndex];
    if (!destination) return alert('Setor de destino não encontrado.');
    if (!Array.isArray(destination.maquinas)) destination.maquinas = [];

    const current = stockRecords().filter(row => allocationKeys.has(row.key));
    if (!current.length) return alert('Os equipamentos selecionados não estão mais disponíveis no estoque.');

    const groups = new Map();
    current.forEach(row => {
      if (!groups.has(row.sectorIndex)) groups.set(row.sectorIndex, []);
      groups.get(row.sectorIndex).push(row);
    });

    const moved = [];
    groups.forEach((rows, sourceIndex) => {
      const source = list[sourceIndex];
      if (!source || !Array.isArray(source.maquinas)) return;
      rows.sort((a,b) => b.assetIndex - a.assetIndex).forEach(row => {
        const asset = source.maquinas[row.assetIndex];
        if (!asset) return;
        asset.situacaoPatrimonial = 'ativo';
        asset.usuarioResponsavel = responsible;
        asset.atualizadoEm = new Date().toISOString();
        if (sourceIndex !== destinationIndex) {
          source.maquinas.splice(row.assetIndex,1);
          destination.maquinas.push(asset);
        }
        moved.push(asset);
      });
    });

    if (!moved.length) return alert('Nenhum equipamento pôde ser alocado.');
    if (!persist()) return;

    state.selected.clear();
    closeAllocateModal();
    try { window.renderSetores?.(document.getElementById('searchInput')?.value?.trim().toLowerCase() || null); } catch {}
    window.RRN_UI?.updateOverview?.();
    window.RRN_TABS?.renderHome?.();
    render();
  }

  function installObservers() {
    window.addEventListener('storage', e => { if (e.key === 'setores' && document.body.classList.contains('rrn-tab-stock')) render(); });
    window.addEventListener('rrn:inventory-remote-update', () => { if (document.body.classList.contains('rrn-tab-stock')) render(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && document.getElementById('rrnStockAllocateModal')?.classList.contains('is-open')) closeAllocateModal();
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
        if (location.hash.toLowerCase() === '#stock' || location.hash.toLowerCase() === '#estoque') openStockTab();
      }
    }, 50);
    installObservers();
  }

  window.RRN_STOCK = { open: openStockTab, render };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
