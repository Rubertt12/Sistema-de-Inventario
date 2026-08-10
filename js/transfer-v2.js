(() => {
  'use strict';

  let sourceIndex = null;
  let destinationIndex = null;
  let selectedAssetId = null;

  const normalize = value => String(value ?? '').trim().toLowerCase();

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

  function clearState() {
    sourceIndex = null;
    destinationIndex = null;
    selectedAssetId = null;
    try {
      setorSelecionadoOrigem = null;
      setorSelecionadoDestino = null;
      maquinaSelecionada = null;
    } catch {}
  }

  function selectedAsset() {
    const source = list()[sourceIndex];
    return source?.maquinas?.find(asset => String(asset?.id) === String(selectedAssetId)) || null;
  }

  function syncLegacyState() {
    try {
      setorSelecionadoOrigem = sourceIndex == null ? null : list()[sourceIndex] || null;
      setorSelecionadoDestino = destinationIndex == null ? null : list()[destinationIndex] || null;
      maquinaSelecionada = selectedAsset();
    } catch {}
  }

  function button(label, className = '') {
    const el = document.createElement('button');
    el.type = 'button';
    el.textContent = label;
    if (className) el.className = className;
    return el;
  }

  function empty(text) {
    const p = document.createElement('p');
    p.className = 'rrn-transfer-empty';
    p.textContent = text;
    return p;
  }

  function renderSourceSectors(term = '') {
    const host = document.getElementById('listaOrigem');
    if (!host) return;
    host.replaceChildren();

    const matches = list()
      .map((sector, index) => ({ sector, index }))
      .filter(({ sector }) => normalize(sector?.nome).includes(normalize(term)));

    if (!matches.length) {
      host.appendChild(empty('Nenhum setor de origem encontrado.'));
      return;
    }

    matches.forEach(({ sector, index }) => {
      const el = button(`${sector.nome || 'Setor'} · ${(sector.maquinas || []).length} equipamento(s)`, 'rrn-transfer-choice');
      el.addEventListener('click', () => {
        sourceIndex = index;
        destinationIndex = null;
        selectedAssetId = null;
        syncLegacyState();
        renderAssets();
        renderDestinations(document.getElementById('buscaSetorDestino')?.value || '');
        updateSummary();
      });
      host.appendChild(el);
    });
  }

  function renderAssets() {
    const host = document.getElementById('listaOrigem');
    if (!host) return;
    host.replaceChildren();

    const source = list()[sourceIndex];
    if (!source) {
      renderSourceSectors(document.getElementById('buscaSetorOrigem')?.value || '');
      return;
    }

    const back = button('← Voltar aos setores', 'rrn-transfer-back');
    back.addEventListener('click', () => {
      sourceIndex = null;
      destinationIndex = null;
      selectedAssetId = null;
      syncLegacyState();
      renderSourceSectors(document.getElementById('buscaSetorOrigem')?.value || '');
      renderDestinations(document.getElementById('buscaSetorDestino')?.value || '');
      updateSummary();
    });
    host.appendChild(back);

    const title = document.createElement('strong');
    title.className = 'rrn-transfer-section-title';
    title.textContent = `Equipamentos de ${source.nome || 'Setor'}`;
    host.appendChild(title);

    const assets = Array.isArray(source.maquinas) ? source.maquinas : [];
    if (!assets.length) {
      host.appendChild(empty('Este setor não possui equipamentos.'));
      return;
    }

    assets.forEach(asset => {
      const id = String(asset?.id || '');
      const label = asset?.etiqueta || asset?.nome || asset?.tipo || 'Equipamento';
      const el = button(label, 'rrn-transfer-choice rrn-transfer-asset');
      if (id && id === String(selectedAssetId)) el.classList.add('is-selected');
      el.addEventListener('click', () => {
        selectedAssetId = id;
        syncLegacyState();
        renderAssets();
        updateSummary();
      });
      host.appendChild(el);
    });
  }

  function renderDestinations(term = '') {
    const host = document.getElementById('listaDestino');
    if (!host) return;
    host.replaceChildren();

    if (sourceIndex == null) {
      host.appendChild(empty('Selecione primeiro um setor de origem.'));
      return;
    }

    const matches = list()
      .map((sector, index) => ({ sector, index }))
      .filter(({ sector, index }) => index !== sourceIndex && normalize(sector?.nome).includes(normalize(term)));

    if (!matches.length) {
      host.appendChild(empty('Nenhum setor de destino encontrado.'));
      return;
    }

    matches.forEach(({ sector, index }) => {
      const el = button(`${sector.nome || 'Setor'} · ${(sector.maquinas || []).length} equipamento(s)`, 'rrn-transfer-choice');
      if (index === destinationIndex) el.classList.add('is-selected');
      el.addEventListener('click', () => {
        destinationIndex = index;
        syncLegacyState();
        renderDestinations(document.getElementById('buscaSetorDestino')?.value || '');
        updateSummary();
      });
      host.appendChild(el);
    });
  }

  function updateSummary() {
    const host = document.getElementById('infoTransferencia');
    const confirm = document.querySelector('#modalTransferencia .btn-confirmar');
    if (!host) return;

    const source = sourceIndex == null ? null : list()[sourceIndex];
    const destination = destinationIndex == null ? null : list()[destinationIndex];
    const asset = selectedAsset();

    const ready = Boolean(source && destination && asset && sourceIndex !== destinationIndex);
    if (confirm) confirm.disabled = !ready;

    if (!source) {
      host.textContent = 'Escolha o setor de origem, o equipamento e o setor de destino.';
      return;
    }
    if (!asset) {
      host.textContent = `Origem: ${source.nome}. Agora selecione um equipamento.`;
      return;
    }
    if (!destination) {
      host.textContent = `${asset.etiqueta || asset.nome || 'Equipamento'} selecionado. Escolha o destino.`;
      return;
    }
    host.textContent = `${asset.etiqueta || asset.nome || 'Equipamento'}: ${source.nome} → ${destination.nome}`;
  }

  function abrirModalTransferenciaV2() {
    const host = modal();
    if (!host) return;
    clearState();

    host.innerHTML = `
      <div class="modal-transferencia-content rrn-transfer-v2" role="dialog" aria-modal="true" aria-labelledby="rrnTransferTitle">
        <div class="rrn-transfer-head">
          <div><span>Movimentação patrimonial</span><h2 id="rrnTransferTitle">Transferir equipamento</h2><small>Selecione origem, equipamento e destino. Nada é alterado antes da confirmação.</small></div>
          <button type="button" class="btn-fechar" aria-label="Fechar">×</button>
        </div>
        <div class="caixas-transferencia">
          <section class="box-setor origem">
            <h3>Origem e equipamento</h3>
            <input type="search" id="buscaSetorOrigem" placeholder="Pesquisar setor de origem" autocomplete="off">
            <div id="listaOrigem" class="lista-maquinas rrn-transfer-list"></div>
          </section>
          <section class="box-setor destino">
            <h3>Setor de destino</h3>
            <input type="search" id="buscaSetorDestino" placeholder="Pesquisar setor de destino" autocomplete="off">
            <div id="listaDestino" class="lista-destino rrn-transfer-list"></div>
          </section>
        </div>
        <div id="infoTransferencia" class="info-transferencia"></div>
        <div class="rrn-transfer-actions">
          <button type="button" class="rrn-transfer-cancel">Cancelar</button>
          <button type="button" class="btn-confirmar" disabled>Confirmar transferência</button>
        </div>
      </div>`;

    host.style.display = 'flex';
    host.querySelector('.btn-fechar').addEventListener('click', fecharModalTransferenciaV2);
    host.querySelector('.rrn-transfer-cancel').addEventListener('click', fecharModalTransferenciaV2);
    host.querySelector('.btn-confirmar').addEventListener('click', () => window.confirmarTransferencia());
    host.addEventListener('click', event => { if (event.target === host) fecharModalTransferenciaV2(); }, { once: true });

    document.getElementById('buscaSetorOrigem').addEventListener('input', event => {
      if (sourceIndex != null) {
        sourceIndex = null;
        destinationIndex = null;
        selectedAssetId = null;
        syncLegacyState();
      }
      renderSourceSectors(event.target.value);
      renderDestinations(document.getElementById('buscaSetorDestino')?.value || '');
      updateSummary();
    });
    document.getElementById('buscaSetorDestino').addEventListener('input', event => renderDestinations(event.target.value));

    renderSourceSectors();
    renderDestinations();
    updateSummary();
  }

  function fecharModalTransferenciaV2() {
    const host = modal();
    if (host) host.style.display = 'none';
    clearState();
  }

  function confirmarTransferenciaV2() {
    const source = sourceIndex == null ? null : list()[sourceIndex];
    const destination = destinationIndex == null ? null : list()[destinationIndex];
    const asset = selectedAsset();
    if (!source || !destination || !asset || sourceIndex === destinationIndex) {
      alert('Selecione origem, equipamento e destino antes de confirmar.');
      return;
    }

    const currentIndex = source.maquinas.findIndex(item => String(item?.id) === String(asset.id));
    if (currentIndex < 0) {
      alert('O equipamento não está mais no setor de origem. Atualize e tente novamente.');
      return;
    }

    const [moved] = source.maquinas.splice(currentIndex, 1);
    if (!Array.isArray(destination.maquinas)) destination.maquinas = [];
    destination.maquinas.push(moved);

    if (typeof saveSetoresAndMachines === 'function') saveSetoresAndMachines();
    else localStorage.setItem('setores', JSON.stringify(list()));

    const term = activeSearchTerm();
    if (typeof renderSetores === 'function') renderSetores(term);
    window.RRN_UI?.updateOverview?.();
    fecharModalTransferenciaV2();
  }

  function buscarSetorOrigemV2() {
    renderSourceSectors(document.getElementById('buscaSetorOrigem')?.value || '');
  }

  function buscarSetorDestinoV2() {
    renderDestinations(document.getElementById('buscaSetorDestino')?.value || '');
  }

  function installStyle() {
    if (document.getElementById('rrn-transfer-v2-style')) return;
    const style = document.createElement('style');
    style.id = 'rrn-transfer-v2-style';
    style.textContent = `
      #modalTransferencia{z-index:1700;background:rgba(19,31,48,.55);backdrop-filter:blur(5px)}
      .rrn-transfer-v2{width:min(980px,calc(100vw - 36px));max-height:calc(100vh - 44px);overflow:auto;padding:24px;border:2px solid #295991;border-radius:18px;background:#f5f0df;box-shadow:0 24px 70px rgba(20,38,63,.3)}
      .rrn-transfer-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:18px}.rrn-transfer-head span{display:block;color:#295991;font-size:.68rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.rrn-transfer-head h2{margin:2px 0 3px;color:#295991}.rrn-transfer-head small{color:#657185}.rrn-transfer-head .btn-fechar{flex:0 0 auto}
      .rrn-transfer-v2 .caixas-transferencia{display:grid;grid-template-columns:1fr 1fr;gap:16px}.rrn-transfer-v2 .box-setor{min-width:0;padding:16px;border:1px solid rgba(41,89,145,.22);border-radius:14px;background:rgba(255,255,255,.48)}.rrn-transfer-v2 .box-setor h3{margin:0 0 10px!important;padding:0!important;max-width:none!important;text-align:left!important;font-size:.9rem!important}
      .rrn-transfer-v2 input[type=search]{width:100%;min-height:42px;margin:0 0 10px;padding:9px 12px;border:1.5px solid rgba(41,89,145,.28);border-radius:10px;background:#fff;color:#26374f;font:inherit;outline:none}.rrn-transfer-v2 input[type=search]:focus{border-color:#295991;box-shadow:0 0 0 3px rgba(237,158,245,.25)}
      .rrn-transfer-list{display:flex!important;flex-direction:column;gap:7px;max-height:330px;overflow:auto;padding:2px}.rrn-transfer-choice{width:100%;margin:0!important;padding:10px 12px!important;border:1px solid rgba(41,89,145,.18)!important;border-radius:9px!important;background:rgba(255,255,255,.72)!important;color:#295991!important;text-align:left!important;font:inherit;font-size:.76rem!important;font-weight:600!important;box-shadow:none!important}.rrn-transfer-choice:hover,.rrn-transfer-choice.is-selected{border-color:#295991!important;background:#f2bf4f!important}.rrn-transfer-back{align-self:flex-start;margin:0 0 4px;padding:7px 10px;border:0;border-radius:8px;background:#295991;color:#fff;font:inherit;font-size:.72rem;font-weight:700}.rrn-transfer-section-title{display:block;margin:4px 0;color:#295991}.rrn-transfer-empty{padding:14px;color:#697487;font-size:.76rem;text-align:center}
      .rrn-transfer-v2 .info-transferencia{margin:14px 0 0;padding:11px 13px;border-radius:10px;background:rgba(242,191,79,.25);color:#295991;font-size:.78rem;font-weight:600}.rrn-transfer-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:14px}.rrn-transfer-actions button{min-height:40px;padding:9px 14px;border-radius:9px;font:inherit;font-weight:700}.rrn-transfer-cancel{border:1px solid rgba(41,89,145,.25);background:#fff;color:#295991}.rrn-transfer-actions .btn-confirmar{border:1px solid #295991;background:#295991;color:#fff}.rrn-transfer-actions .btn-confirmar:disabled{opacity:.45;cursor:not-allowed}
      @media(max-width:720px){.rrn-transfer-v2{padding:18px}.rrn-transfer-v2 .caixas-transferencia{grid-template-columns:1fr}.rrn-transfer-list{max-height:220px}.rrn-transfer-head small{display:none}}
    `;
    document.head.appendChild(style);
  }

  function install() {
    installStyle();
    window.abrirModalTransferencia = abrirModalTransferenciaV2;
    window.fecharModalTransferencia = fecharModalTransferenciaV2;
    window.confirmarTransferencia = confirmarTransferenciaV2;
    window.buscarSetorOrigem = buscarSetorOrigemV2;
    window.buscarSetorDestino = buscarSetorDestinoV2;
    window.soltarMaquina = event => event?.preventDefault?.();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
