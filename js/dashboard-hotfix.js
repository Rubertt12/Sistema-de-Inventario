(() => {
  'use strict';

  const HOTFIX_MARK = '__RRN_DASHBOARD_HOTFIX_20260810__';
  if (window[HOTFIX_MARK]) return;
  window[HOTFIX_MARK] = true;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  function equipmentIcon(tipo) {
    const value = String(tipo || '').toLowerCase();
    if (value.includes('notebook')) return '💻';
    if (value.includes('monitor')) return '🖥️';
    if (value.includes('impress')) return '🖨️';
    if (value.includes('workstation')) return '🧰';
    return '🖥️';
  }

  function canOperate() {
    const role = window.RRN_SESSION?.role;
    if (role) return role !== 'monitoramento';
    try {
      return JSON.parse(localStorage.getItem('usuarioLogado') || '{}').perfil !== 'monitoramento';
    } catch {
      return true;
    }
  }

  function installOptimizedRenderer() {
    try {
      if (typeof setores === 'undefined' || typeof setoresVisiveis === 'undefined') return false;
    } catch {
      return false;
    }

    if (window.renderSetores?.__rrnOptimized20260810) return true;

    const optimized = function renderSetoresOptimized(termoBusca = null) {
      const container = document.getElementById('setoresContainer');
      if (!container) return;

      const termo = String(termoBusca || '').trim().toLowerCase();
      const listaSetores = Array.isArray(setores) ? setores : [];
      const indicesBase = (typeof setoresFiltradosIndices !== 'undefined' && setoresFiltradosIndices != null)
        ? setoresFiltradosIndices
        : listaSetores.map((_, index) => index);

      const indicesParaMostrar = indicesBase.filter(index => {
        const setor = listaSetores[index];
        if (!setor) return false;
        if (!termo) return true;
        if (String(setor.nome || '').toLowerCase().includes(termo)) return true;
        return (Array.isArray(setor.maquinas) ? setor.maquinas : []).some(maquina => [
          maquina?.nome,
          maquina?.tipo,
          maquina?.etiqueta,
          maquina?.usuarioResponsavel
        ].some(value => String(value || '').toLowerCase().includes(termo)));
      });

      container.replaceChildren();

      if (!indicesParaMostrar.length) {
        container.innerHTML = `
          <div class="rrn-empty-state">
            <span>🔎</span>
            <strong>Nenhum setor ou equipamento encontrado</strong>
            <small>Tente outro termo de pesquisa ou crie um novo setor.</small>
          </div>`;
        document.getElementById('setoresPaginacao')?.remove();
        window.RRN_UI?.updateOverview?.();
        return;
      }

      const porPagina = (typeof setoresPorPagina === 'number' && setoresPorPagina > 0) ? setoresPorPagina : 10;
      const totalPaginas = Math.max(1, Math.ceil(indicesParaMostrar.length / porPagina));
      if (typeof paginaSetoresAtual !== 'number' || paginaSetoresAtual < 1) paginaSetoresAtual = 1;
      if (paginaSetoresAtual > totalPaginas) paginaSetoresAtual = totalPaginas;

      const inicio = (paginaSetoresAtual - 1) * porPagina;
      const indicesPaginados = indicesParaMostrar.slice(inicio, inicio + porPagina);
      const podeOperar = canOperate();
      const fragment = document.createDocumentFragment();

      indicesPaginados.forEach(setorIndex => {
        const setor = listaSetores[setorIndex];
        if (!setor) return;
        if (!Array.isArray(setor.maquinas)) setor.maquinas = [];

        const setorMatch = Boolean(termo) && String(setor.nome || '').toLowerCase().includes(termo);
        const aberto = Boolean(setoresVisiveis[setorIndex]) || Boolean(termo);

        // Ponto principal da hotfix: quando o setor está fechado, NÃO criamos
        // centenas de elementos escondidos. A lista só é montada ao abrir o setor
        // ou durante uma pesquisa.
        let maquinasFiltradas = [];
        if (aberto) {
          maquinasFiltradas = termo && !setorMatch
            ? setor.maquinas.filter(maquina => [
                maquina?.nome,
                maquina?.tipo,
                maquina?.etiqueta,
                maquina?.usuarioResponsavel
              ].some(value => String(value || '').toLowerCase().includes(termo)))
            : setor.maquinas;
        }

        const emManutencao = setor.maquinas.reduce((total, maquina) => total + (maquina?.emManutencao ? 1 : 0), 0);
        const card = document.createElement('section');
        card.className = 'setor rrn-setor-card';
        card.dataset.setorIndex = String(setorIndex);
        card.ondragover = event => event.preventDefault();
        card.ondrop = event => typeof dropMachine === 'function' && dropMachine(event, setorIndex);

        const itens = aberto
          ? maquinasFiltradas.map(maquina => {
              const maquinaIndex = setor.maquinas.indexOf(maquina);
              const statusClass = maquina?.emManutencao ? 'maintenance' : 'online';
              const statusLabel = maquina?.emManutencao ? 'Em manutenção' : 'Operando';
              const usuario = maquina?.usuarioResponsavel
                ? `<span class="rrn-machine-user">👤 ${escapeHtml(maquina.usuarioResponsavel)}</span>`
                : '';
              const etiqueta = maquina?.etiqueta
                ? `<span class="rrn-machine-tag">🏷️ ${escapeHtml(maquina.etiqueta)}</span>`
                : '';

              return `
                <article class="rrn-machine-item ${statusClass}" draggable="${podeOperar ? 'true' : 'false'}"
                  ${podeOperar ? `ondragstart="dragStart(event, ${setorIndex}, ${maquinaIndex})"` : ''}>
                  <div class="rrn-machine-icon" aria-hidden="true">${equipmentIcon(maquina?.tipo)}</div>
                  <div class="rrn-machine-main">
                    <div class="rrn-machine-title-row">
                      <strong>${escapeHtml(maquina?.nome || 'Equipamento sem nome')}</strong>
                      <span class="rrn-status ${statusClass}">${statusLabel}</span>
                    </div>
                    <div class="rrn-machine-meta">
                      <span>${escapeHtml(maquina?.tipo || 'Equipamento')}</span>
                      ${etiqueta}
                      ${usuario}
                    </div>
                  </div>
                  <div class="rrn-machine-actions">
                    <button type="button" class="rrn-btn rrn-btn-info" onclick="showInfo(${setorIndex}, ${maquinaIndex})">Info</button>
                    ${podeOperar ? `<button type="button" class="rrn-btn rrn-btn-danger operador-only" onclick="removeMaquina(${setorIndex}, ${maquinaIndex})">Excluir</button>` : ''}
                  </div>
                </article>`;
            }).join('')
          : '';

        const emptyState = aberto && !itens
          ? `<div class="rrn-sector-empty">
               <span>📦</span>
               <div><strong>Este setor ainda está vazio</strong><small>${podeOperar ? 'Use “Adicionar equipamento” para começar.' : 'Nenhum equipamento cadastrado neste setor.'}</small></div>
             </div>`
          : '';

        card.innerHTML = `
          <div class="setor-header rrn-setor-header">
            <div class="rrn-setor-title">
              <span class="rrn-setor-icon" aria-hidden="true">🏢</span>
              <div>
                <h2>${escapeHtml(setor.nome || 'Setor sem nome')}</h2>
                <div class="rrn-setor-summary">
                  <span>${setor.maquinas.length} ${setor.maquinas.length === 1 ? 'equipamento' : 'equipamentos'}</span>
                  ${emManutencao ? `<span class="rrn-maintenance-count">${emManutencao} em manutenção</span>` : '<span class="rrn-all-ok">Tudo operando</span>'}
                </div>
              </div>
            </div>
            ${podeOperar ? `
              <div class="rrn-setor-admin operador-only">
                <button type="button" class="rrn-icon-btn" onclick="editSetorName(${setorIndex})" title="Renomear setor">✏️</button>
                <button type="button" class="rrn-icon-btn danger" onclick="removeSetor(${setorIndex})" title="Excluir setor">🗑️</button>
              </div>` : ''}
          </div>

          <div class="rrn-setor-toolbar">
            ${podeOperar ? `<button type="button" class="rrn-btn rrn-btn-primary operador-only" onclick="abrirModalMaquina(${setorIndex})">＋ Adicionar equipamento</button>` : ''}
            <button type="button" class="rrn-btn rrn-btn-secondary" onclick="toggleMachines(${setorIndex})">
              ${aberto ? 'Ocultar equipamentos' : `Mostrar equipamentos (${setor.maquinas.length})`}
            </button>
          </div>

          <div id="maquinas-${setorIndex}" class="rrn-machines-list" style="display:${aberto ? 'grid' : 'none'}">
            ${itens || emptyState}
          </div>`;

        fragment.appendChild(card);
      });

      container.appendChild(fragment);
      if (typeof renderizarPaginacaoSetores === 'function') renderizarPaginacaoSetores(totalPaginas);
      window.RRN_UI?.updateOverview?.();
    };

    optimized.__rrnOptimized20260810 = true;
    window.renderSetores = optimized;
    return true;
  }

  function readExtraFields() {
    const read = id => document.getElementById(id)?.value?.trim() || '';
    return {
      fabricante: read('rrnFabricante'),
      modelo: read('rrnModelo'),
      localizacao: read('rrnLocalizacao'),
      situacaoPatrimonial: read('rrnSituacaoPatrimonial') || 'ativo',
      dataCompra: read('rrnDataCompra'),
      garantiaAte: read('rrnGarantiaAte'),
      observacoesAtivo: read('rrnObservacoesAtivo')
    };
  }

  function installFastAdd() {
    const current = window.confirmarAddMaquina;
    if (typeof current !== 'function') return false;
    if (current.__rrnFastAdd20260810) return true;

    const base = current.__rrnOriginal || current;
    if (typeof base !== 'function') return false;

    const fast = function confirmarAddMaquinaFast(...args) {
      let sectorIndex = null;
      let beforeIds = new Set();
      let beforeLength = 0;
      const extras = readExtraFields();

      try {
        sectorIndex = setorSelecionado;
        const list = setores?.[sectorIndex]?.maquinas;
        if (Array.isArray(list)) {
          beforeLength = list.length;
          beforeIds = new Set(list.map(item => item?.id).filter(Boolean));
        }
      } catch {}

      const finish = () => {
        try {
          const list = setores?.[sectorIndex]?.maquinas;
          if (!Array.isArray(list) || list.length <= beforeLength) return;
          const added = list.find(item => item?.id && !beforeIds.has(item.id)) || list[list.length - 1];
          if (!added) return;

          Object.entries(extras).forEach(([key, value]) => {
            if (value !== '') added[key] = value;
          });
          added.cadastradoEm ||= new Date().toISOString();
          added.atualizadoEm = new Date().toISOString();

          // O núcleo já persistiu e renderizou uma vez. Salvamos apenas os campos
          // complementares, sem disparar uma segunda reconstrução completa do DOM.
          if (typeof saveSetoresAndMachines === 'function') saveSetoresAndMachines();
          else localStorage.setItem('setores', JSON.stringify(setores));

          const sectorName = setores?.[sectorIndex]?.nome || 'Setor';
          window.RRN_HISTORY?.recordEvent?.({
            entityType: 'asset',
            entityId: added.id ? `id:${added.id}` : `tag:${String(added.etiqueta || '').toLowerCase()}`,
            eventType: 'created',
            source: 'confirmarAddMaquina',
            title: 'Equipamento adicionado',
            assetLabel: added.etiqueta || added.nome || added.tipo || 'Equipamento',
            toSector: sectorName,
            details: { asset: JSON.parse(JSON.stringify(added)) }
          });

          window.RRN_UI?.updateOverview?.();
        } catch (error) {
          console.warn('RRN Manager: falha ao finalizar cadastro otimizado.', error);
        }
      };

      const result = base.apply(this, args);
      if (result && typeof result.then === 'function') return result.finally(finish);
      finish();
      return result;
    };

    fast.__rrnFastAdd20260810 = true;
    fast.__rrnEnhancedAdd = true;
    fast.__rrnOriginal = base;
    window.confirmarAddMaquina = fast;
    return true;
  }

  function installProfileLayout() {
    if (!document.getElementById('rrn-profile-layout-hotfix')) {
      const style = document.createElement('style');
      style.id = 'rrn-profile-layout-hotfix';
      style.textContent = `
        #configModal.rrn-settings {
          width: min(1120px, calc(100vw - 48px)) !important;
          max-width: 1120px !important;
          max-height: calc(100vh - 48px) !important;
          padding: 26px 28px 24px !important;
          grid-template-columns: minmax(250px, 310px) minmax(0, 1fr) !important;
          grid-template-rows: auto auto 1fr auto !important;
          align-items: start !important;
          gap: 14px 28px !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
        }
        #configModal.rrn-settings .modal-title {
          position: static !important;
          grid-column: 1 / -1 !important;
          transform: none !important;
          justify-self: center !important;
          width: fit-content !important;
          max-width: calc(100% - 80px) !important;
          margin: 0 !important;
        }
        #configModal.rrn-settings .rrn-settings-subtitle {
          grid-column: 1 / -1 !important;
          margin: 0 auto 8px !important;
        }
        #configModal.rrn-settings .modal-left {
          grid-column: 1 !important;
          grid-row: 3 !important;
          width: 100% !important;
          min-width: 0 !important;
          align-self: stretch !important;
          justify-content: flex-start !important;
          padding: 22px !important;
          gap: 16px !important;
        }
        #configModal.rrn-settings .modal-right {
          grid-column: 2 !important;
          grid-row: 3 !important;
          width: 100% !important;
          min-width: 0 !important;
          max-height: none !important;
          overflow: visible !important;
          padding: 4px 0 0 !important;
          gap: 12px !important;
        }
        #configModal.rrn-settings .rrn-settings-save,
        #configModal.rrn-settings > .save-btn {
          grid-column: 1 / -1 !important;
          grid-row: 4 !important;
          justify-self: end !important;
          width: auto !important;
          min-width: 150px !important;
          margin: 4px 0 0 !important;
        }
        #configModal.rrn-settings .box-bg-selector {
          max-width: none !important;
          width: 100% !important;
          padding: 16px !important;
        }
        #configModal.rrn-settings .modal-right > button {
          width: 100% !important;
          max-width: none !important;
          white-space: normal !important;
          text-align: center !important;
        }
        @media (max-width: 820px) {
          #configModal.rrn-settings {
            width: calc(100vw - 24px) !important;
            max-height: calc(100vh - 24px) !important;
            padding: 62px 16px 20px !important;
            grid-template-columns: 1fr !important;
            grid-template-rows: auto auto auto auto auto !important;
            gap: 14px !important;
          }
          #configModal.rrn-settings .modal-title {
            position: absolute !important;
            top: 14px !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
          }
          #configModal.rrn-settings .rrn-settings-subtitle,
          #configModal.rrn-settings .modal-left,
          #configModal.rrn-settings .modal-right,
          #configModal.rrn-settings .rrn-settings-save,
          #configModal.rrn-settings > .save-btn {
            grid-column: 1 !important;
            grid-row: auto !important;
          }
          #configModal.rrn-settings .modal-right {
            overflow: visible !important;
          }
        }
      `;
      document.head.appendChild(style);
    }

    const originalOpen = window.openConfigModal;
    if (typeof originalOpen === 'function' && !originalOpen.__rrnProfileHotfix) {
      const patched = function openConfigModalPatched(...args) {
        const result = originalOpen.apply(this, args);
        const modal = document.getElementById('configModal');
        if (modal) modal.style.display = 'grid';
        return result;
      };
      patched.__rrnProfileHotfix = true;
      window.openConfigModal = patched;
    }
  }

  function installAll() {
    installOptimizedRenderer();
    installFastAdd();
    installProfileLayout();
  }

  if (document.readyState === 'complete') {
    setTimeout(installAll, 60);
  } else {
    window.addEventListener('load', () => setTimeout(installAll, 120), { once: true });
  }

  // Reforço contra módulos legados que reinstalam wrappers nos primeiros segundos.
  [450, 1000, 2200, 4200].forEach(delay => setTimeout(installAll, delay));
})();