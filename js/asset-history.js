(() => {
  'use strict';

  const HISTORY_KEY = 'asset_history';
  const MAX_EVENTS = 1500;
  const MUTATORS = [
    'removeMaquina',
    'dropMachine',
    'confirmarTransferencia',
    'markForMaintenance',
    'releaseMachine',
    'saveObservation',
    'editSetorName',
    'removeSetor'
  ];

  const extraFields = [
    ['fabricante', 'Fabricante'],
    ['modelo', 'Modelo'],
    ['localizacao', 'Localização'],
    ['situacaoPatrimonial', 'Situação'],
    ['dataCompra', 'Data da compra'],
    ['garantiaAte', 'Garantia até'],
    ['observacoesAtivo', 'Observações']
  ];

  let modal = null;
  let editModal = null;
  let containerObserver = null;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  function currentActor() {
    if (window.RRN_SESSION) {
      return {
        id: window.RRN_SESSION.userId || null,
        name: window.RRN_SESSION.userName || 'Usuário autenticado',
        role: window.RRN_SESSION.role || null,
        tenantId: window.RRN_SESSION.tenantId || null
      };
    }
    try {
      const user = JSON.parse(localStorage.getItem('usuarioLogado') || '{}');
      return {
        id: user.id || null,
        name: user.nome || user.email || 'Usuário local',
        role: user.perfil || null,
        tenantId: user.tenant_id || null
      };
    } catch {
      return { id: null, name: 'Usuário local', role: null, tenantId: null };
    }
  }

  function canOperate() {
    const role = currentActor().role;
    return role !== 'monitoramento';
  }

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

  function persistInventory() {
    try {
      if (typeof saveSetoresAndMachines === 'function') {
        saveSetoresAndMachines();
      } else {
        localStorage.setItem('setores', JSON.stringify(inventory()));
      }
    } catch (error) {
      console.warn('RRN Manager: falha ao persistir equipamento enriquecido.', error);
    }
  }

  function assetIdentity(asset) {
    if (!asset) return '';
    if (asset.id != null && String(asset.id).trim()) return `id:${String(asset.id)}`;
    if (asset.etiqueta) return `tag:${String(asset.etiqueta).trim().toLowerCase()}`;
    return `legacy:${String(asset.nome || '').trim().toLowerCase()}|${String(asset.tipo || '').trim().toLowerCase()}`;
  }

  function snapshot() {
    const map = new Map();
    inventory().forEach((sector, sectorIndex) => {
      const sectorName = sector?.nome || `Setor ${sectorIndex + 1}`;
      (Array.isArray(sector?.maquinas) ? sector.maquinas : []).forEach((asset, assetIndex) => {
        let key = assetIdentity(asset);
        if (!key) key = `slot:${sectorIndex}:${assetIndex}`;
        if (map.has(key)) key = `${key}#${sectorIndex}:${assetIndex}`;
        map.set(key, {
          key,
          sectorIndex,
          assetIndex,
          sectorName,
          asset: JSON.parse(JSON.stringify(asset || {}))
        });
      });
    });
    return map;
  }

  function readHistory() {
    try {
      const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeHistory(events) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
  }

  function eventId() {
    if (crypto?.randomUUID) return crypto.randomUUID();
    return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function recordEvent(event) {
    const actor = currentActor();
    const events = readHistory();
    events.push({
      id: eventId(),
      timestamp: new Date().toISOString(),
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      tenantId: actor.tenantId,
      ...event
    });
    writeHistory(events);
  }

  function changedFields(before, after) {
    const fields = [
      'nome', 'tipo', 'etiqueta', 'usuarioResponsavel', 'fabricante', 'modelo',
      'localizacao', 'situacaoPatrimonial', 'dataCompra', 'garantiaAte', 'observacoesAtivo'
    ];
    return fields.filter(field => JSON.stringify(before?.[field] ?? null) !== JSON.stringify(after?.[field] ?? null));
  }

  function describeAsset(asset) {
    return asset?.etiqueta || asset?.nome || asset?.tipo || 'Equipamento';
  }

  function emitDiff(beforeMap, afterMap, source = 'alteracao') {
    const nowSeen = new Set();

    afterMap.forEach((after, key) => {
      const before = beforeMap.get(key);
      nowSeen.add(key);

      if (!before) {
        recordEvent({
          entityType: 'asset', entityId: key, eventType: 'created', source,
          title: 'Equipamento adicionado', assetLabel: describeAsset(after.asset),
          toSector: after.sectorName, details: { asset: after.asset }
        });
        return;
      }

      if (before.sectorName !== after.sectorName) {
        recordEvent({
          entityType: 'asset', entityId: key, eventType: 'moved', source,
          title: 'Equipamento transferido', assetLabel: describeAsset(after.asset),
          fromSector: before.sectorName, toSector: after.sectorName
        });
      }

      if (Boolean(before.asset?.emManutencao) !== Boolean(after.asset?.emManutencao)) {
        const started = Boolean(after.asset?.emManutencao);
        recordEvent({
          entityType: 'asset', entityId: key,
          eventType: started ? 'maintenance_started' : 'maintenance_finished', source,
          title: started ? 'Enviado para manutenção' : 'Liberado da manutenção',
          assetLabel: describeAsset(after.asset), toSector: after.sectorName
        });
      }

      const beforeCalls = Array.isArray(before.asset?.chamado) ? before.asset.chamado.length : 0;
      const afterCalls = Array.isArray(after.asset?.chamado) ? after.asset.chamado.length : 0;
      if (afterCalls > beforeCalls) {
        recordEvent({
          entityType: 'asset', entityId: key, eventType: 'ticket_added', source,
          title: 'Chamado registrado', assetLabel: describeAsset(after.asset),
          toSector: after.sectorName,
          details: { totalChamados: afterCalls }
        });
      }

      const changes = changedFields(before.asset, after.asset);
      if (changes.length) {
        recordEvent({
          entityType: 'asset', entityId: key, eventType: 'updated', source,
          title: 'Cadastro do equipamento atualizado', assetLabel: describeAsset(after.asset),
          toSector: after.sectorName, details: { fields: changes }
        });
      }
    });

    beforeMap.forEach((before, key) => {
      if (nowSeen.has(key)) return;
      recordEvent({
        entityType: 'asset', entityId: key, eventType: 'deleted', source,
        title: 'Equipamento removido', assetLabel: describeAsset(before.asset),
        fromSector: before.sectorName, details: { asset: before.asset }
      });
    });
  }

  function afterMutation(before, source) {
    setTimeout(() => {
      try {
        emitDiff(before, snapshot(), source);
        decorateRenderedAssets();
        window.RRN_UI?.updateOverview?.();
      } catch (error) {
        console.warn('RRN Manager: falha ao registrar auditoria.', error);
      }
    }, 30);
  }

  function wrapMutation(name) {
    const original = window[name];
    if (typeof original !== 'function' || original.__rrnAudited) return false;

    const wrapped = function(...args) {
      const before = snapshot();
      const result = original.apply(this, args);
      if (result && typeof result.then === 'function') {
        return result.finally(() => afterMutation(before, name));
      }
      afterMutation(before, name);
      return result;
    };
    wrapped.__rrnAudited = true;
    wrapped.__rrnOriginal = original;
    window[name] = wrapped;
    return true;
  }

  function getExtraValues() {
    const value = id => document.getElementById(id)?.value?.trim() || '';
    return {
      fabricante: value('rrnFabricante'),
      modelo: value('rrnModelo'),
      localizacao: value('rrnLocalizacao'),
      situacaoPatrimonial: value('rrnSituacaoPatrimonial') || 'ativo',
      dataCompra: value('rrnDataCompra'),
      garantiaAte: value('rrnGarantiaAte'),
      observacoesAtivo: value('rrnObservacoesAtivo')
    };
  }

  function clearExtraFields() {
    ['rrnFabricante', 'rrnModelo', 'rrnLocalizacao', 'rrnDataCompra', 'rrnGarantiaAte', 'rrnObservacoesAtivo']
      .forEach(id => { const node = document.getElementById(id); if (node) node.value = ''; });
    const status = document.getElementById('rrnSituacaoPatrimonial');
    if (status) status.value = 'ativo';
  }

  function wrapAddAsset() {
    const original = window.confirmarAddMaquina;
    if (typeof original !== 'function' || original.__rrnEnhancedAdd) return false;

    const wrapped = function(...args) {
      const before = snapshot();
      const extras = getExtraValues();
      const result = original.apply(this, args);

      const finish = () => setTimeout(() => {
        const after = snapshot();
        const newEntries = [...after.entries()].filter(([key]) => !before.has(key));
        if (newEntries.length) {
          const [, newest] = newEntries[newEntries.length - 1];
          const list = inventory();
          const target = list[newest.sectorIndex]?.maquinas?.[newest.assetIndex];
          if (target) {
            Object.entries(extras).forEach(([key, value]) => {
              if (value !== '') target[key] = value;
            });
            target.cadastradoEm ||= new Date().toISOString();
            target.atualizadoEm = new Date().toISOString();
            persistInventory();
            try { if (typeof renderSetores === 'function') renderSetores(); } catch {}
          }
        }
        emitDiff(before, snapshot(), 'confirmarAddMaquina');
        decorateRenderedAssets();
        clearExtraFields();
      }, 40);

      if (result && typeof result.then === 'function') return result.finally(finish);
      finish();
      return result;
    };

    wrapped.__rrnEnhancedAdd = true;
    wrapped.__rrnOriginal = original;
    window.confirmarAddMaquina = wrapped;
    return true;
  }

  function wrapOpenAssetModal() {
    const original = window.abrirModalMaquina;
    if (typeof original !== 'function' || original.__rrnEnhancedOpen) return false;
    const wrapped = function(...args) {
      clearExtraFields();
      return original.apply(this, args);
    };
    wrapped.__rrnEnhancedOpen = true;
    window.abrirModalMaquina = wrapped;
    return true;
  }

  function enhanceAddAssetModal() {
    const content = document.querySelector('#modalMaquina .modal-content');
    if (!content || content.querySelector('.rrn-extra-asset-fields')) return;
    const actions = [...content.children].find(node => node.tagName === 'DIV' && /justify-content:\s*flex-end/i.test(node.getAttribute('style') || ''));
    const block = document.createElement('section');
    block.className = 'rrn-extra-asset-fields';
    block.innerHTML = `
      <h3 class="rrn-extra-heading">Dados complementares do ativo</h3>
      <div class="rrn-asset-form-grid">
        <div class="rrn-asset-field"><label for="rrnFabricante">Fabricante</label><input id="rrnFabricante" type="text" placeholder="Ex: Dell"></div>
        <div class="rrn-asset-field"><label for="rrnModelo">Modelo</label><input id="rrnModelo" type="text" placeholder="Ex: Latitude 3420"></div>
        <div class="rrn-asset-field"><label for="rrnLocalizacao">Localização</label><input id="rrnLocalizacao" type="text" placeholder="Ex: 2º andar / Mesa 24"></div>
        <div class="rrn-asset-field"><label for="rrnSituacaoPatrimonial">Situação patrimonial</label><select id="rrnSituacaoPatrimonial"><option value="ativo">Ativo</option><option value="estoque">Em estoque</option><option value="emprestado">Emprestado</option><option value="baixado">Baixado</option></select></div>
        <div class="rrn-asset-field"><label for="rrnDataCompra">Data da compra</label><input id="rrnDataCompra" type="date"></div>
        <div class="rrn-asset-field"><label for="rrnGarantiaAte">Garantia até</label><input id="rrnGarantiaAte" type="date"></div>
        <div class="rrn-asset-field full"><label for="rrnObservacoesAtivo">Observações do ativo</label><textarea id="rrnObservacoesAtivo" placeholder="Informações permanentes do equipamento"></textarea></div>
      </div>`;
    if (actions) content.insertBefore(block, actions);
    else content.appendChild(block);
  }

  function ensureHistoryModal() {
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'rrn-history-modal';
    modal.id = 'rrnHistoryModal';
    modal.innerHTML = `
      <div class="rrn-history-dialog" role="dialog" aria-modal="true" aria-labelledby="rrnHistoryTitle">
        <header class="rrn-history-header">
          <div><span id="rrnHistoryEyebrow">Histórico</span><strong id="rrnHistoryTitle">Equipamento</strong><small id="rrnHistorySubtitle"></small></div>
          <button type="button" class="rrn-history-close" aria-label="Fechar">×</button>
        </header>
        <div class="rrn-history-body" id="rrnHistoryBody"></div>
      </div>`;
    modal.querySelector('.rrn-history-close').addEventListener('click', closeHistoryModal);
    modal.addEventListener('click', event => { if (event.target === modal) closeHistoryModal(); });
    document.body.appendChild(modal);
    return modal;
  }

  function closeHistoryModal() {
    modal?.classList.remove('is-open');
  }

  function iconForEvent(type) {
    return ({
      created: '＋', moved: '↔', maintenance_started: '🛠', maintenance_finished: '✓',
      ticket_added: '🎫', updated: '✎', deleted: '−', sector_created: '🏢', sector_deleted: '🗑'
    })[type] || '•';
  }

  function descriptionForEvent(event) {
    if (event.eventType === 'moved') return `${escapeHtml(event.fromSector || 'Origem')} → ${escapeHtml(event.toSector || 'Destino')}`;
    if (event.eventType === 'created') return `Adicionado em ${escapeHtml(event.toSector || 'setor não informado')}`;
    if (event.eventType === 'deleted') return `Removido de ${escapeHtml(event.fromSector || 'setor não informado')}`;
    if (event.eventType === 'updated' && event.details?.fields?.length) return `Campos alterados: ${event.details.fields.map(escapeHtml).join(', ')}`;
    if (event.eventType === 'ticket_added') return `${event.details?.totalChamados || 1} chamado(s) registrado(s)`;
    return escapeHtml(event.toSector || event.fromSector || '');
  }

  function timelineHtml(events) {
    if (!events.length) {
      return '<div class="rrn-history-empty"><span>🕘</span><strong>Nenhum evento registrado</strong><small>As próximas alterações serão adicionadas automaticamente.</small></div>';
    }
    return `<div class="rrn-timeline">${events.map(event => `
      <div class="rrn-timeline-item">
        <div class="rrn-timeline-dot">${iconForEvent(event.eventType)}</div>
        <div class="rrn-timeline-card">
          <strong>${escapeHtml(event.title || event.eventType)}</strong>
          <small>${descriptionForEvent(event)}</small>
          <div class="rrn-timeline-meta"><span>${new Date(event.timestamp).toLocaleString('pt-BR')}</span><span>por ${escapeHtml(event.actorName || 'Usuário')}</span>${event.actorRole ? `<span>${escapeHtml(event.actorRole)}</span>` : ''}</div>
        </div>
      </div>`).join('')}</div>`;
  }

  function openAssetHistory(sectorIndex, assetIndex) {
    const asset = inventory()[sectorIndex]?.maquinas?.[assetIndex];
    if (!asset) return;
    const key = assetIdentity(asset);
    const events = readHistory().filter(event => event.entityType === 'asset' && event.entityId === key).reverse();
    ensureHistoryModal();
    modal.querySelector('#rrnHistoryEyebrow').textContent = 'Histórico do equipamento';
    modal.querySelector('#rrnHistoryTitle').textContent = describeAsset(asset);
    modal.querySelector('#rrnHistorySubtitle').textContent = `${asset.tipo || 'Equipamento'} · ${inventory()[sectorIndex]?.nome || 'Setor'}`;
    modal.querySelector('#rrnHistoryBody').innerHTML = timelineHtml(events);
    modal.classList.add('is-open');
  }

  function renderAudit(filter = '', type = 'all') {
    const body = modal?.querySelector('#rrnHistoryBody');
    if (!body) return;
    const term = filter.trim().toLowerCase();
    const all = readHistory().slice().reverse();
    const events = all.filter(event => {
      const matchesType = type === 'all' || event.eventType === type;
      const haystack = [event.title, event.assetLabel, event.actorName, event.fromSector, event.toSector, event.eventType].join(' ').toLowerCase();
      return matchesType && (!term || haystack.includes(term));
    });
    const toolbar = `
      <div class="rrn-audit-toolbar">
        <input id="rrnAuditSearch" type="search" placeholder="Pesquisar equipamento, setor ou usuário" value="${escapeHtml(filter)}">
        <select id="rrnAuditType">
          <option value="all">Todos os eventos</option>
          <option value="created">Adicionados</option>
          <option value="moved">Transferências</option>
          <option value="maintenance_started">Entrada em manutenção</option>
          <option value="maintenance_finished">Saída de manutenção</option>
          <option value="ticket_added">Chamados</option>
          <option value="updated">Edições</option>
          <option value="deleted">Exclusões</option>
        </select>
      </div>`;
    body.innerHTML = toolbar + timelineHtml(events.slice(0, 300));
    const select = body.querySelector('#rrnAuditType');
    select.value = type;
    body.querySelector('#rrnAuditSearch').addEventListener('input', event => renderAudit(event.target.value, select.value));
    select.addEventListener('change', event => renderAudit(body.querySelector('#rrnAuditSearch').value, event.target.value));
  }

  function openAuditLog() {
    ensureHistoryModal();
    modal.querySelector('#rrnHistoryEyebrow').textContent = 'Auditoria do workspace';
    modal.querySelector('#rrnHistoryTitle').textContent = 'Histórico de alterações';
    modal.querySelector('#rrnHistorySubtitle').textContent = 'Criações, transferências, manutenções, chamados, edições e exclusões.';
    renderAudit();
    modal.classList.add('is-open');
  }

  function ensureEditModal() {
    if (editModal) return editModal;
    editModal = document.createElement('div');
    editModal.className = 'rrn-history-modal';
    editModal.id = 'rrnEditAssetModal';
    document.body.appendChild(editModal);
    return editModal;
  }

  function openEditAsset(sectorIndex, assetIndex) {
    if (!canOperate()) return;
    const asset = inventory()[sectorIndex]?.maquinas?.[assetIndex];
    if (!asset) return;
    const host = ensureEditModal();
    host.innerHTML = `
      <div class="rrn-history-dialog" role="dialog" aria-modal="true">
        <header class="rrn-history-header"><div><span>Cadastro patrimonial</span><strong>Editar equipamento</strong><small>${escapeHtml(describeAsset(asset))}</small></div><button type="button" class="rrn-history-close">×</button></header>
        <div class="rrn-history-body">
          <div class="rrn-asset-form-grid">
            <div class="rrn-asset-field"><label>Número de série / nome</label><input data-field="nome" value="${escapeHtml(asset.nome || '')}"></div>
            <div class="rrn-asset-field"><label>Etiqueta / patrimônio</label><input data-field="etiqueta" value="${escapeHtml(asset.etiqueta || '')}"></div>
            <div class="rrn-asset-field"><label>Tipo</label><input data-field="tipo" value="${escapeHtml(asset.tipo || '')}"></div>
            <div class="rrn-asset-field"><label>Usuário responsável</label><input data-field="usuarioResponsavel" value="${escapeHtml(asset.usuarioResponsavel || '')}"></div>
            <div class="rrn-asset-field"><label>Fabricante</label><input data-field="fabricante" value="${escapeHtml(asset.fabricante || '')}"></div>
            <div class="rrn-asset-field"><label>Modelo</label><input data-field="modelo" value="${escapeHtml(asset.modelo || '')}"></div>
            <div class="rrn-asset-field"><label>Localização</label><input data-field="localizacao" value="${escapeHtml(asset.localizacao || '')}"></div>
            <div class="rrn-asset-field"><label>Situação patrimonial</label><select data-field="situacaoPatrimonial"><option value="ativo">Ativo</option><option value="estoque">Em estoque</option><option value="emprestado">Emprestado</option><option value="baixado">Baixado</option></select></div>
            <div class="rrn-asset-field"><label>Data da compra</label><input type="date" data-field="dataCompra" value="${escapeHtml(asset.dataCompra || '')}"></div>
            <div class="rrn-asset-field"><label>Garantia até</label><input type="date" data-field="garantiaAte" value="${escapeHtml(asset.garantiaAte || '')}"></div>
            <div class="rrn-asset-field full"><label>Observações permanentes</label><textarea data-field="observacoesAtivo">${escapeHtml(asset.observacoesAtivo || '')}</textarea></div>
          </div>
          <div class="rrn-edit-asset-actions"><button type="button" class="rrn-btn rrn-btn-secondary" data-cancel>Cancelar</button><button type="button" class="rrn-btn rrn-btn-primary" data-save>Salvar alterações</button></div>
        </div>
      </div>`;
    host.querySelector('[data-field="situacaoPatrimonial"]').value = asset.situacaoPatrimonial || 'ativo';
    const close = () => host.classList.remove('is-open');
    host.querySelector('.rrn-history-close').addEventListener('click', close);
    host.querySelector('[data-cancel]').addEventListener('click', close);
    host.addEventListener('click', event => { if (event.target === host) close(); }, { once: true });
    host.querySelector('[data-save]').addEventListener('click', () => {
      const before = snapshot();
      host.querySelectorAll('[data-field]').forEach(input => { asset[input.dataset.field] = input.value.trim(); });
      asset.atualizadoEm = new Date().toISOString();
      persistInventory();
      try { if (typeof renderSetores === 'function') renderSetores(); } catch {}
      emitDiff(before, snapshot(), 'editarAtivo');
      decorateRenderedAssets();
      close();
    });
    host.classList.add('is-open');
  }

  function parseIndices(button) {
    const text = button?.getAttribute('onclick') || '';
    const match = text.match(/showInfo\((\d+)\s*,\s*(\d+)\)/);
    return match ? [Number(match[1]), Number(match[2])] : null;
  }

  function decorateRenderedAssets() {
    document.querySelectorAll('.rrn-machine-item').forEach(item => {
      const infoButton = [...item.querySelectorAll('button')].find(button => /showInfo\(/.test(button.getAttribute('onclick') || ''));
      const indexes = parseIndices(infoButton);
      if (!indexes) return;
      const [sectorIndex, assetIndex] = indexes;
      const asset = inventory()[sectorIndex]?.maquinas?.[assetIndex];
      if (!asset) return;

      const meta = item.querySelector('.rrn-machine-meta');
      if (meta && !meta.querySelector('.rrn-enriched-meta')) {
        const values = [asset.fabricante, asset.modelo, asset.localizacao].filter(Boolean);
        if (values.length) {
          const span = document.createElement('span');
          span.className = 'rrn-enriched-meta';
          span.textContent = `• ${values.join(' · ')}`;
          meta.appendChild(span);
        }
      }

      const actions = item.querySelector('.rrn-machine-actions');
      if (!actions) return;
      if (!actions.querySelector('.rrn-btn-history')) {
        const history = document.createElement('button');
        history.type = 'button';
        history.className = 'rrn-btn rrn-btn-history';
        history.textContent = 'Histórico';
        history.addEventListener('click', () => openAssetHistory(sectorIndex, assetIndex));
        actions.insertBefore(history, actions.firstChild);
      }
      if (canOperate() && !actions.querySelector('.rrn-btn-edit-asset')) {
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'rrn-btn rrn-btn-secondary rrn-btn-edit-asset operador-only';
        edit.textContent = 'Editar';
        edit.addEventListener('click', () => openEditAsset(sectorIndex, assetIndex));
        actions.insertBefore(edit, infoButton || null);
      }
    });
  }

  function injectAuditButton() {
    const right = document.querySelector('#configModal .modal-right');
    if (!right || right.querySelector('[data-rrn-audit-button]')) return;
    const heading = document.createElement('h3');
    heading.className = 'rrn-settings-label';
    heading.textContent = 'AUDITORIA';
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.rrnAuditButton = '1';
    button.textContent = '🧾 Histórico de alterações';
    button.addEventListener('click', openAuditLog);
    right.append(heading, button);
  }

  function installMutationWrappers() {
    let installed = 0;
    if (wrapAddAsset()) installed += 1;
    if (wrapOpenAssetModal()) installed += 1;
    MUTATORS.forEach(name => { if (wrapMutation(name)) installed += 1; });
    return installed;
  }

  function boot() {
    enhanceAddAssetModal();
    injectAuditButton();
    installMutationWrappers();
    decorateRenderedAssets();

    const container = document.getElementById('setoresContainer');
    if (container && !containerObserver) {
      containerObserver = new MutationObserver(() => decorateRenderedAssets());
      containerObserver.observe(container, { childList: true, subtree: true });
    }

    let attempts = 0;
    const retry = setInterval(() => {
      attempts += 1;
      enhanceAddAssetModal();
      injectAuditButton();
      installMutationWrappers();
      decorateRenderedAssets();
      if (attempts >= 12) clearInterval(retry);
    }, 350);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
  window.addEventListener('load', () => setTimeout(boot, 40));

  window.rrnOpenAssetHistory = openAssetHistory;
  window.rrnOpenAuditLog = openAuditLog;
  window.rrnEditAsset = openEditAsset;
  window.RRN_HISTORY = Object.freeze({ recordEvent, readHistory, openAssetHistory, openAuditLog });
})();
