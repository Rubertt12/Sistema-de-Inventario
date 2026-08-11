(() => {
  'use strict';

  if (window.__RRN_TRANSFER_V3__) return;
  window.__RRN_TRANSFER_V3__ = true;

  let sourceIndex = null;
  let destinationIndex = null;
  let selectedAssetKey = null;

  const normalize = value => String(value ?? '').trim().toLowerCase();
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));

  function list() {
    try { return Array.isArray(setores) ? setores : []; }
    catch { return []; }
  }

  function modal() {
    return document.getElementById('modalTransferencia');
  }

  function activeSearchTerm() {
    return document.getElementById('searchInput')?.value?.trim().toLowerCase() || null;
  }

  function assetKey(asset, index) {
    const id = String(asset?.id ?? '').trim();
    if (id) return `id:${id}`;
    return `idx:${index}|${normalize(asset?.etiqueta)}|${normalize(asset?.nome)}|${normalize(asset?.tipo)}`;
  }

  function selectedAssetRecord() {
    const source = list()[sourceIndex];
    if (!source || !Array.isArray(source.maquinas)) return null;
    const index = source.maquinas.findIndex((asset, i) => assetKey(asset, i) === selectedAssetKey);
    if (index < 0) return null;
    return { asset: source.maquinas[index], index };
  }

  function selectedAsset() {
    return selectedAssetRecord()?.asset || null;
  }

  function clearState() {
    sourceIndex = null;
    destinationIndex = null;
    selectedAssetKey = null;
    syncLegacyState();
  }

  function syncLegacyState() {
    try {
      setorSelecionadoOrigem = sourceIndex == null ? null : list()[sourceIndex] || null;
      setorSelecionadoDestino = destinationIndex == null ? null : list()[destinationIndex] || null;
      maquinaSelecionada = selectedAsset();
    } catch {}
  }

  function equipmentLabel(asset) {
    return String(asset?.etiqueta || asset?.nome || asset?.tipo || 'Equipamento');
  }

  function equipmentSearchText(asset) {
    return [
      asset?.nome,
      asset?.tipo,
      asset?.etiqueta,
      asset?.usuarioResponsavel,
      asset?.fabricante,
      asset?.modelo,
      asset?.serial,
      asset?.numeroSerie,
      asset?.serviceTag,
      asset?.localizacao
    ].map(normalize).join(' ');
  }

  function equipmentMeta(asset) {
    const parts = [
      asset?.tipo,
      [asset?.fabricante, asset?.modelo].filter(Boolean).join(' '),
      asset?.usuarioResponsavel ? `Responsável: ${asset.usuarioResponsavel}` : null
    ].filter(Boolean);
    return parts.join(' · ');
  }

  function createEmpty(text, icon = 'info') {
    const wrap = document.createElement('div');
    wrap.className = 'rrn-transfer-empty';
    const iconEl = document.createElement('span');
    iconEl.dataset.rrnIcon = icon;
    iconEl.setAttribute('aria-hidden', 'true');
    const copy = document.createElement('span');
    copy.textContent = text;
    wrap.append(iconEl, copy);
    return wrap;
  }

  function createSectorChoice(sector, index, kind) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'rrn-transfer-choice rrn-transfer-sector';
    const selected = kind === 'source' ? index === sourceIndex : index === destinationIndex;
    if (selected) el.classList.add('is-selected');
    el.setAttribute('aria-pressed', String(selected));

    const count = Array.isArray(sector?.maquinas) ? sector.maquinas.length : 0;
    const maintenance = Array.isArray(sector?.maquinas)
      ? sector.maquinas.filter(asset => asset?.emManutencao).length
      : 0;

    el.innerHTML = `
      <span class="rrn-transfer-choice-icon" data-rrn-icon="building" aria-hidden="true"></span>
      <span class="rrn-transfer-choice-copy">
        <strong>${esc(sector?.nome || 'Setor sem nome')}</strong>
        <small>${count} ${count === 1 ? 'equipamento' : 'equipamentos'}${maintenance ? ` · ${maintenance} em manutenção` : ''}</small>
      </span>
      <span class="rrn-transfer-choice-mark" data-rrn-icon="check" aria-hidden="true"></span>`;
    return el;
  }

  function createAssetChoice(asset, index) {
    const key = assetKey(asset, index);
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'rrn-transfer-choice rrn-transfer-asset';
    const selected = key === selectedAssetKey;
    if (selected) el.classList.add('is-selected');
    el.setAttribute('aria-pressed', String(selected));

    const status = asset?.emManutencao ? 'Em manutenção' : 'Disponível para transferência';
    const statusClass = asset?.emManutencao ? 'maintenance' : 'ok';
    el.innerHTML = `
      <span class="rrn-transfer-choice-icon" data-rrn-icon="monitor" aria-hidden="true"></span>
      <span class="rrn-transfer-choice-copy">
        <strong>${esc(equipmentLabel(asset))}</strong>
        <small>${esc(equipmentMeta(asset) || 'Sem informações complementares')}</small>
        <span class="rrn-transfer-asset-status ${statusClass}">${esc(status)}</span>
      </span>
      <span class="rrn-transfer-choice-mark" data-rrn-icon="check" aria-hidden="true"></span>`;
    el.addEventListener('click', () => {
      selectedAssetKey = key;
      syncLegacyState();
      renderAssets(document.getElementById('buscaEquipamentoTransferencia')?.value || '');
      updateState();
    });
    return el;
  }

  function renderSourceSectors(term = '') {
    const host = document.getElementById('listaOrigem');
    if (!host) return;
    host.replaceChildren();

    const matches = list()
      .map((sector, index) => ({ sector, index }))
      .filter(({ sector }) => normalize(sector?.nome).includes(normalize(term)));

    if (!matches.length) {
      host.appendChild(createEmpty('Nenhum setor de origem encontrado.', 'search'));
      return;
    }

    matches.forEach(({ sector, index }) => {
      const el = createSectorChoice(sector, index, 'source');
      el.addEventListener('click', () => {
        const changed = sourceIndex !== index;
        sourceIndex = index;
        if (changed) {
          selectedAssetKey = null;
          destinationIndex = null;
          const assetSearch = document.getElementById('buscaEquipamentoTransferencia');
          if (assetSearch) assetSearch.value = '';
        }
        syncLegacyState();
        renderAll();
        document.getElementById('buscaEquipamentoTransferencia')?.focus();
      });
      host.appendChild(el);
    });
  }

  function renderAssets(term = '') {
    const host = document.getElementById('listaEquipamentosTransferencia');
    if (!host) return;
    host.replaceChildren();

    const source = sourceIndex == null ? null : list()[sourceIndex];
    const input = document.getElementById('buscaEquipamentoTransferencia');
    if (input) input.disabled = !source;

    if (!source) {
      host.appendChild(createEmpty('Selecione um setor de origem para listar os equipamentos.', 'inventory'));
      return;
    }

    const assets = (Array.isArray(source.maquinas) ? source.maquinas : [])
      .map((asset, index) => ({ asset, index }))
      .filter(({ asset }) => equipmentSearchText(asset).includes(normalize(term)));

    if (!assets.length) {
      host.appendChild(createEmpty(
        source.maquinas?.length ? 'Nenhum equipamento corresponde à pesquisa.' : 'Este setor não possui equipamentos.',
        source.maquinas?.length ? 'search' : 'box'
      ));
      return;
    }

    assets.forEach(({ asset, index }) => host.appendChild(createAssetChoice(asset, index)));
  }

  function renderDestinations(term = '') {
    const host = document.getElementById('listaDestino');
    if (!host) return;
    host.replaceChildren();

    const input = document.getElementById('buscaSetorDestino');
    if (input) input.disabled = sourceIndex == null;

    if (sourceIndex == null) {
      host.appendChild(createEmpty('Selecione a origem antes de escolher o destino.', 'building'));
      return;
    }

    const matches = list()
      .map((sector, index) => ({ sector, index }))
      .filter(({ sector, index }) => index !== sourceIndex && normalize(sector?.nome).includes(normalize(term)));

    if (!matches.length) {
      host.appendChild(createEmpty('Nenhum setor de destino encontrado.', 'search'));
      return;
    }

    matches.forEach(({ sector, index }) => {
      const el = createSectorChoice(sector, index, 'destination');
      el.addEventListener('click', () => {
        destinationIndex = index;
        syncLegacyState();
        renderDestinations(document.getElementById('buscaSetorDestino')?.value || '');
        updateState();
      });
      host.appendChild(el);
    });
  }

  function renderAll() {
    renderSourceSectors(document.getElementById('buscaSetorOrigem')?.value || '');
    renderAssets(document.getElementById('buscaEquipamentoTransferencia')?.value || '');
    renderDestinations(document.getElementById('buscaSetorDestino')?.value || '');
    updateState();
    window.RRN_ICONS?.decorateStatic?.(modal() || document);
  }

  function stepState(step, done, active) {
    const el = document.querySelector(`#modalTransferencia [data-transfer-step="${step}"]`);
    if (!el) return;
    el.classList.toggle('is-done', done);
    el.classList.toggle('is-active', active);
    el.setAttribute('aria-current', active ? 'step' : 'false');
  }

  function updateState() {
    const host = document.getElementById('infoTransferencia');
    const confirm = document.querySelector('#modalTransferencia .btn-confirmar');
    if (!host) return;

    const source = sourceIndex == null ? null : list()[sourceIndex];
    const destination = destinationIndex == null ? null : list()[destinationIndex];
    const asset = selectedAsset();
    const ready = Boolean(source && destination && asset && sourceIndex !== destinationIndex);

    if (confirm) confirm.disabled = !ready;

    stepState('1', Boolean(source), !source);
    stepState('2', Boolean(asset), Boolean(source && !asset));
    stepState('3', Boolean(destination), Boolean(source && asset && !destination));

    host.classList.toggle('is-ready', ready);
    host.replaceChildren();

    const eyebrow = document.createElement('span');
    eyebrow.className = 'rrn-transfer-summary-eyebrow';
    eyebrow.textContent = ready ? 'Transferência pronta para confirmar' : 'Resumo da movimentação';

    const route = document.createElement('div');
    route.className = 'rrn-transfer-route';
    route.innerHTML = `
      <div><small>Origem</small><strong>${esc(source?.nome || 'Não selecionada')}</strong></div>
      <span class="rrn-transfer-route-arrow" data-rrn-icon="transfer" aria-hidden="true"></span>
      <div><small>Destino</small><strong>${esc(destination?.nome || 'Não selecionado')}</strong></div>`;

    const assetLine = document.createElement('div');
    assetLine.className = 'rrn-transfer-summary-asset';
    if (asset) {
      assetLine.innerHTML = `
        <span data-rrn-icon="monitor" aria-hidden="true"></span>
        <div><small>Equipamento</small><strong>${esc(equipmentLabel(asset))}</strong><span>${esc(equipmentMeta(asset) || 'Sem informações complementares')}</span></div>`;
    } else {
      assetLine.innerHTML = `
        <span data-rrn-icon="info" aria-hidden="true"></span>
        <div><strong>Complete as três etapas acima</strong><span>Nenhum equipamento será movimentado antes da confirmação.</span></div>`;
    }

    host.append(eyebrow, route, assetLine);
    window.RRN_ICONS?.decorateStatic?.(host);
  }

  function abrirModalTransferenciaV3() {
    const host = modal();
    if (!host) return;
    clearState();

    host.innerHTML = `
      <div class="modal-transferencia-content rrn-transfer-v3" role="dialog" aria-modal="true" aria-labelledby="rrnTransferTitle">
        <header class="rrn-transfer-head">
          <div>
            <span class="rrn-transfer-eyebrow">Movimentação patrimonial</span>
            <h2 id="rrnTransferTitle">Transferir equipamento</h2>
            <small>Escolha a origem, o equipamento e o novo setor. A movimentação só ocorre após sua confirmação.</small>
          </div>
          <button type="button" class="btn-fechar" aria-label="Fechar janela de transferência">×</button>
        </header>

        <div class="rrn-transfer-steps" aria-label="Etapas da transferência">
          <div data-transfer-step="1" class="rrn-transfer-step is-active"><span>1</span><div><strong>Origem</strong><small>Setor atual</small></div></div>
          <div class="rrn-transfer-step-line"></div>
          <div data-transfer-step="2" class="rrn-transfer-step"><span>2</span><div><strong>Equipamento</strong><small>Ativo a mover</small></div></div>
          <div class="rrn-transfer-step-line"></div>
          <div data-transfer-step="3" class="rrn-transfer-step"><span>3</span><div><strong>Destino</strong><small>Novo setor</small></div></div>
        </div>

        <div class="rrn-transfer-columns">
          <section class="rrn-transfer-panel">
            <div class="rrn-transfer-panel-head"><span data-rrn-icon="building" aria-hidden="true"></span><div><strong>1. Setor de origem</strong><small>Onde o equipamento está agora</small></div></div>
            <input type="search" id="buscaSetorOrigem" placeholder="Pesquisar setor..." autocomplete="off" aria-label="Pesquisar setor de origem">
            <div id="listaOrigem" class="rrn-transfer-list"></div>
          </section>

          <section class="rrn-transfer-panel">
            <div class="rrn-transfer-panel-head"><span data-rrn-icon="monitor" aria-hidden="true"></span><div><strong>2. Equipamento</strong><small>Selecione o ativo que será transferido</small></div></div>
            <input type="search" id="buscaEquipamentoTransferencia" placeholder="Nome, patrimônio, usuário, serial..." autocomplete="off" aria-label="Pesquisar equipamento" disabled>
            <div id="listaEquipamentosTransferencia" class="rrn-transfer-list"></div>
          </section>

          <section class="rrn-transfer-panel">
            <div class="rrn-transfer-panel-head"><span data-rrn-icon="transfer" aria-hidden="true"></span><div><strong>3. Setor de destino</strong><small>Para onde o equipamento irá</small></div></div>
            <input type="search" id="buscaSetorDestino" placeholder="Pesquisar destino..." autocomplete="off" aria-label="Pesquisar setor de destino" disabled>
            <div id="listaDestino" class="rrn-transfer-list"></div>
          </section>
        </div>

        <div id="infoTransferencia" class="rrn-transfer-summary" aria-live="polite"></div>
        <footer class="rrn-transfer-actions">
          <button type="button" class="rrn-transfer-cancel">Cancelar</button>
          <button type="button" class="btn-confirmar" disabled data-rrn-icon="transfer">Confirmar transferência</button>
        </footer>
      </div>`;

    host.style.display = 'flex';
    host.onclick = event => { if (event.target === host) fecharModalTransferenciaV3(); };

    host.querySelector('.btn-fechar')?.addEventListener('click', fecharModalTransferenciaV3);
    host.querySelector('.rrn-transfer-cancel')?.addEventListener('click', fecharModalTransferenciaV3);
    host.querySelector('.btn-confirmar')?.addEventListener('click', () => window.confirmarTransferencia());

    document.getElementById('buscaSetorOrigem')?.addEventListener('input', event => renderSourceSectors(event.target.value));
    document.getElementById('buscaEquipamentoTransferencia')?.addEventListener('input', event => renderAssets(event.target.value));
    document.getElementById('buscaSetorDestino')?.addEventListener('input', event => renderDestinations(event.target.value));

    renderAll();
    requestAnimationFrame(() => document.getElementById('buscaSetorOrigem')?.focus());
  }

  function fecharModalTransferenciaV3() {
    const host = modal();
    if (host) {
      host.style.display = 'none';
      host.onclick = null;
    }
    clearState();
  }

  function showSuccessToast(asset, source, destination) {
    document.getElementById('rrnTransferSuccessToast')?.remove();
    const toast = document.createElement('div');
    toast.id = 'rrnTransferSuccessToast';
    toast.className = 'rrn-transfer-toast';
    toast.innerHTML = `
      <span data-rrn-icon="check" aria-hidden="true"></span>
      <div><strong>Transferência concluída</strong><small>${esc(equipmentLabel(asset))}: ${esc(source?.nome || 'Origem')} → ${esc(destination?.nome || 'Destino')}</small></div>`;
    document.body.appendChild(toast);
    window.RRN_ICONS?.decorateStatic?.(toast);
    requestAnimationFrame(() => toast.classList.add('is-visible'));
    setTimeout(() => {
      toast.classList.remove('is-visible');
      setTimeout(() => toast.remove(), 220);
    }, 3200);
  }

  function confirmarTransferenciaV3() {
    const source = sourceIndex == null ? null : list()[sourceIndex];
    const destination = destinationIndex == null ? null : list()[destinationIndex];
    const record = selectedAssetRecord();
    const asset = record?.asset;

    if (!source || !destination || !asset || sourceIndex === destinationIndex) {
      alert('Selecione o setor de origem, o equipamento e o setor de destino antes de confirmar.');
      return;
    }

    const currentIndex = record.index;
    if (!source.maquinas?.[currentIndex] || assetKey(source.maquinas[currentIndex], currentIndex) !== selectedAssetKey) {
      alert('O equipamento não está mais no setor de origem. Atualize a tela e tente novamente.');
      return;
    }

    const sourceSnapshot = { nome: source.nome };
    const destinationSnapshot = { nome: destination.nome };
    const [moved] = source.maquinas.splice(currentIndex, 1);
    if (!Array.isArray(destination.maquinas)) destination.maquinas = [];
    destination.maquinas.push(moved);

    try {
      if (typeof saveSetoresAndMachines === 'function') saveSetoresAndMachines();
      else localStorage.setItem('setores', JSON.stringify(list()));
    } catch (error) {
      destination.maquinas.pop();
      source.maquinas.splice(currentIndex, 0, moved);
      console.error('RRN Manager: falha ao persistir transferência.', error);
      alert('Não foi possível salvar a transferência. Nenhuma alteração foi mantida.');
      return;
    }

    const term = activeSearchTerm();
    if (typeof renderSetores === 'function') renderSetores(term);
    window.RRN_UI?.updateOverview?.();
    window.RRN_TABS?.renderHome?.();
    fecharModalTransferenciaV3();
    showSuccessToast(moved, sourceSnapshot, destinationSnapshot);
  }

  function buscarSetorOrigemV3() {
    renderSourceSectors(document.getElementById('buscaSetorOrigem')?.value || '');
  }

  function buscarSetorDestinoV3() {
    renderDestinations(document.getElementById('buscaSetorDestino')?.value || '');
  }

  function installStyle() {
    if (document.getElementById('rrn-transfer-v3-style')) return;
    const style = document.createElement('style');
    style.id = 'rrn-transfer-v3-style';
    style.textContent = `
      #modalTransferencia{z-index:1700;background:rgba(19,31,48,.58);backdrop-filter:blur(6px);padding:18px}
      .rrn-transfer-v3{width:min(1180px,100%);max-height:calc(100vh - 36px);overflow:auto;padding:24px;border:2px solid #295991;border-radius:20px;background:#f7f2e4;box-shadow:0 28px 80px rgba(20,38,63,.34);color:#26374f}
      .rrn-transfer-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px}.rrn-transfer-eyebrow{display:block;color:#295991;font-size:.66rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.rrn-transfer-head h2{margin:3px 0 4px!important;padding:0!important;max-width:none!important;color:#295991!important;text-align:left!important;font-size:1.45rem!important}.rrn-transfer-head small{display:block;max-width:700px;color:#687487;font-size:.73rem;line-height:1.5}.rrn-transfer-head .btn-fechar{flex:0 0 auto;width:38px!important;height:38px!important;margin:0!important;padding:0!important;border:1px solid rgba(41,89,145,.18)!important;border-radius:10px!important;background:rgba(255,255,255,.72)!important;color:#295991!important;font-size:1.35rem!important;box-shadow:none!important}
      .rrn-transfer-steps{display:grid;grid-template-columns:auto 1fr auto 1fr auto;align-items:center;gap:10px;margin:20px 0 17px;padding:12px 14px;border:1px solid rgba(41,89,145,.13);border-radius:13px;background:rgba(255,255,255,.42)}.rrn-transfer-step{display:flex;align-items:center;gap:8px;opacity:.52;transition:opacity .18s ease}.rrn-transfer-step>span{display:grid;width:28px;height:28px;place-items:center;border:1px solid rgba(41,89,145,.25);border-radius:50%;color:#295991;background:#fff;font-size:.68rem;font-weight:800}.rrn-transfer-step strong,.rrn-transfer-step small{display:block}.rrn-transfer-step strong{color:#295991;font-size:.72rem}.rrn-transfer-step small{margin-top:1px;color:#758092;font-size:.58rem}.rrn-transfer-step.is-active,.rrn-transfer-step.is-done{opacity:1}.rrn-transfer-step.is-active>span{border-color:#295991;background:#f2bf4f}.rrn-transfer-step.is-done>span{border-color:#295991;background:#295991;color:#fff}.rrn-transfer-step-line{height:2px;border-radius:99px;background:rgba(41,89,145,.13)}
      .rrn-transfer-columns{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.rrn-transfer-panel{min-width:0;display:flex;flex-direction:column;padding:14px;border:1px solid rgba(41,89,145,.17);border-radius:14px;background:rgba(255,255,255,.48)}.rrn-transfer-panel-head{display:grid;grid-template-columns:34px minmax(0,1fr);align-items:center;gap:9px;margin-bottom:10px}.rrn-transfer-panel-head>span{display:grid!important;width:34px;height:34px;place-items:center;border-radius:9px;color:#295991;background:rgba(237,158,245,.2)}.rrn-transfer-panel-head .rrn-icon{width:16px;height:16px}.rrn-transfer-panel-head strong,.rrn-transfer-panel-head small{display:block}.rrn-transfer-panel-head strong{color:#295991;font-size:.76rem}.rrn-transfer-panel-head small{margin-top:2px;color:#748093;font-size:.59rem;line-height:1.3}
      .rrn-transfer-v3 input[type=search]{width:100%;min-height:42px;margin:0 0 9px;padding:9px 11px;border:1.5px solid rgba(41,89,145,.24);border-radius:10px;background:#fff;color:#26374f;font:500 .72rem Poppins,sans-serif;outline:none}.rrn-transfer-v3 input[type=search]:focus{border-color:#295991;box-shadow:0 0 0 3px rgba(237,158,245,.22)}.rrn-transfer-v3 input[type=search]:disabled{cursor:not-allowed;background:rgba(222,217,196,.35);opacity:.58}
      .rrn-transfer-list{display:flex!important;flex-direction:column;gap:7px;min-height:260px;max-height:360px;overflow:auto;padding:2px 3px 2px 1px;scrollbar-width:thin;scrollbar-color:#ed9ef5 transparent}.rrn-transfer-choice{position:relative;width:100%;display:grid!important;grid-template-columns:34px minmax(0,1fr) 22px;align-items:center;gap:9px;margin:0!important;padding:10px!important;border:1px solid rgba(41,89,145,.14)!important;border-radius:10px!important;background:rgba(255,255,255,.72)!important;color:#26374f!important;text-align:left!important;font:inherit!important;box-shadow:none!important;transition:border-color .15s ease,background .15s ease,transform .15s ease}.rrn-transfer-choice:hover{transform:translateY(-1px);border-color:rgba(41,89,145,.48)!important;background:#fff!important}.rrn-transfer-choice.is-selected{border-color:#295991!important;background:rgba(242,191,79,.25)!important;box-shadow:0 0 0 2px rgba(41,89,145,.06)!important}.rrn-transfer-choice-icon{display:grid!important;width:34px;height:34px;place-items:center;border-radius:9px;color:#295991;background:rgba(41,89,145,.08)}.rrn-transfer-choice-icon .rrn-icon{width:16px;height:16px}.rrn-transfer-choice-copy{min-width:0}.rrn-transfer-choice-copy strong,.rrn-transfer-choice-copy small{display:block}.rrn-transfer-choice-copy strong{overflow:hidden;color:#295991;font-size:.72rem;font-weight:750;text-overflow:ellipsis;white-space:nowrap}.rrn-transfer-choice-copy small{display:-webkit-box;margin-top:3px;overflow:hidden;color:#6e798b;font-size:.59rem;font-weight:500;line-height:1.35;-webkit-box-orient:vertical;-webkit-line-clamp:2}.rrn-transfer-choice-mark{display:none!important;color:#295991}.rrn-transfer-choice.is-selected .rrn-transfer-choice-mark{display:grid!important}.rrn-transfer-choice-mark .rrn-icon{width:16px;height:16px}.rrn-transfer-asset-status{display:inline-flex;margin-top:5px;padding:2px 6px;border-radius:999px;font-size:.52rem;font-weight:750}.rrn-transfer-asset-status.ok{color:#236b3d;background:rgba(72,187,120,.13)}.rrn-transfer-asset-status.maintenance{color:#9b2c2c;background:rgba(255,107,107,.16)}
      .rrn-transfer-empty{min-height:110px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:15px;color:#748093;text-align:center;font-size:.68rem;line-height:1.45}.rrn-transfer-empty>span:first-child{display:grid!important;width:34px;height:34px;place-items:center;border-radius:10px;color:#295991;background:rgba(41,89,145,.07)}.rrn-transfer-empty .rrn-icon{width:16px;height:16px}
      .rrn-transfer-summary{margin-top:13px;padding:13px 14px;border:1px solid rgba(41,89,145,.15);border-radius:13px;background:rgba(222,217,196,.3)}.rrn-transfer-summary.is-ready{border-color:rgba(41,89,145,.28);background:linear-gradient(135deg,rgba(242,191,79,.2),rgba(237,158,245,.12))}.rrn-transfer-summary-eyebrow{display:block;margin-bottom:9px;color:#295991;font-size:.61rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase}.rrn-transfer-route{display:grid;grid-template-columns:1fr 38px 1fr;align-items:center;gap:8px}.rrn-transfer-route>div{min-width:0;padding:8px 10px;border-radius:9px;background:rgba(255,255,255,.62)}.rrn-transfer-route small,.rrn-transfer-route strong{display:block}.rrn-transfer-route small{color:#778294;font-size:.55rem;text-transform:uppercase}.rrn-transfer-route strong{margin-top:2px;overflow:hidden;color:#295991;font-size:.73rem;text-overflow:ellipsis;white-space:nowrap}.rrn-transfer-route-arrow{display:grid!important;place-items:center;color:#295991}.rrn-transfer-route-arrow .rrn-icon{width:18px;height:18px}.rrn-transfer-summary-asset{display:grid;grid-template-columns:32px minmax(0,1fr);align-items:center;gap:9px;margin-top:8px;padding-top:8px;border-top:1px solid rgba(41,89,145,.09)}.rrn-transfer-summary-asset>span:first-child{display:grid!important;width:32px;height:32px;place-items:center;border-radius:9px;color:#295991;background:rgba(237,158,245,.18)}.rrn-transfer-summary-asset .rrn-icon{width:15px;height:15px}.rrn-transfer-summary-asset small,.rrn-transfer-summary-asset strong,.rrn-transfer-summary-asset div>span{display:block}.rrn-transfer-summary-asset small{color:#778294;font-size:.54rem;text-transform:uppercase}.rrn-transfer-summary-asset strong{color:#295991;font-size:.72rem}.rrn-transfer-summary-asset div>span{margin-top:2px;color:#717c8e;font-size:.58rem}
      .rrn-transfer-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:13px}.rrn-transfer-actions button{min-height:40px;margin:0!important;padding:9px 14px!important;border-radius:9px!important;font:700 .72rem Poppins,sans-serif!important}.rrn-transfer-cancel{border:1px solid rgba(41,89,145,.22)!important;background:#fff!important;color:#295991!important}.rrn-transfer-actions .btn-confirmar{display:inline-flex!important;align-items:center;justify-content:center;gap:6px;border:1px solid #295991!important;background:#295991!important;color:#fff!important}.rrn-transfer-actions .btn-confirmar .rrn-icon{width:15px;height:15px}.rrn-transfer-actions .btn-confirmar:disabled{opacity:.4;cursor:not-allowed}
      .rrn-transfer-toast{position:fixed;right:22px;bottom:22px;z-index:2600;display:grid;grid-template-columns:34px minmax(0,1fr);align-items:center;gap:10px;width:min(390px,calc(100vw - 32px));padding:12px 14px;border:1px solid rgba(41,89,145,.22);border-radius:12px;background:#fff;color:#26374f;box-shadow:0 14px 36px rgba(20,38,63,.22);opacity:0;transform:translateY(12px);transition:opacity .2s ease,transform .2s ease}.rrn-transfer-toast.is-visible{opacity:1;transform:none}.rrn-transfer-toast>span{display:grid!important;width:34px;height:34px;place-items:center;border-radius:9px;color:#236b3d;background:rgba(72,187,120,.13)}.rrn-transfer-toast .rrn-icon{width:17px;height:17px}.rrn-transfer-toast strong,.rrn-transfer-toast small{display:block}.rrn-transfer-toast strong{color:#295991;font-size:.74rem}.rrn-transfer-toast small{margin-top:2px;color:#6c7788;font-size:.61rem;line-height:1.4}
      @media(max-width:940px){.rrn-transfer-columns{grid-template-columns:1fr 1fr}.rrn-transfer-panel:last-child{grid-column:1/-1}.rrn-transfer-panel:last-child .rrn-transfer-list{min-height:150px;max-height:220px}}
      @media(max-width:700px){#modalTransferencia{padding:8px}.rrn-transfer-v3{max-height:calc(100vh - 16px);padding:16px;border-radius:15px}.rrn-transfer-head small{display:none}.rrn-transfer-steps{grid-template-columns:1fr 1fr 1fr;gap:5px;padding:9px}.rrn-transfer-step-line{display:none}.rrn-transfer-step{justify-content:center}.rrn-transfer-step div{display:none}.rrn-transfer-columns{grid-template-columns:1fr}.rrn-transfer-panel:last-child{grid-column:auto}.rrn-transfer-list,.rrn-transfer-panel:last-child .rrn-transfer-list{min-height:120px;max-height:210px}.rrn-transfer-route{grid-template-columns:1fr 28px 1fr}.rrn-transfer-actions{position:sticky;bottom:-16px;margin:13px -16px -16px;padding:10px 16px;background:#f7f2e4;border-top:1px solid rgba(41,89,145,.12)}.rrn-transfer-actions button{flex:1 1 0}.rrn-transfer-toast{right:16px;bottom:16px}}
    `;
    document.head.appendChild(style);
  }

  function handleEscape(event) {
    if (event.key !== 'Escape') return;
    const host = modal();
    if (host && getComputedStyle(host).display !== 'none') fecharModalTransferenciaV3();
  }

  function install() {
    installStyle();
    window.abrirModalTransferencia = abrirModalTransferenciaV3;
    window.fecharModalTransferencia = fecharModalTransferenciaV3;
    window.confirmarTransferencia = confirmarTransferenciaV3;
    window.buscarSetorOrigem = buscarSetorOrigemV3;
    window.buscarSetorDestino = buscarSetorDestinoV3;
    window.soltarMaquina = event => event?.preventDefault?.();
    document.addEventListener('keydown', handleEscape);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
