(() => {
  'use strict';

  const TRASH_KEY = 'asset_trash';
  let modal = null;
  let counterButton = null;

  function currentRole() {
    if (window.RRN_SESSION?.role) return window.RRN_SESSION.role;
    try { return JSON.parse(localStorage.getItem('usuarioLogado') || '{}').perfil || null; }
    catch { return null; }
  }

  function canOperate() {
    return currentRole() === 'admin' || currentRole() === 'operador' || !currentRole();
  }

  function isAdmin() {
    return currentRole() === 'admin';
  }

  function actor() {
    if (window.RRN_SESSION) return { id: window.RRN_SESSION.userId || null, name: window.RRN_SESSION.userName || window.RRN_SESSION.name || 'Usuário' };
    try {
      const user = JSON.parse(localStorage.getItem('usuarioLogado') || '{}');
      return { id: user.id || null, name: user.nome || user.email || 'Usuário local' };
    } catch {
      return { id: null, name: 'Usuário local' };
    }
  }

  function inventory() {
    try { if (typeof setores !== 'undefined' && Array.isArray(setores)) return setores; } catch {}
    try {
      const parsed = JSON.parse(localStorage.getItem('setores') || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  function readTrash() {
    try {
      const parsed = JSON.parse(localStorage.getItem(TRASH_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  function writeTrash(items) {
    localStorage.setItem(TRASH_KEY, JSON.stringify(items));
    updateCounter();
  }

  function persistInventory() {
    try {
      if (typeof saveSetoresAndMachines === 'function') saveSetoresAndMachines();
      else localStorage.setItem('setores', JSON.stringify(inventory()));
    } catch (error) {
      console.warn('RRN Manager: falha ao salvar inventário após lixeira.', error);
    }
    try { if (typeof renderSetores === 'function') renderSetores(); } catch {}
    window.RRN_UI?.updateOverview?.();
    setTimeout(decorateDeleteButtons, 40);
  }

  function randomId() {
    return crypto?.randomUUID?.() || `trash_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function addTrashItem(item) {
    const who = actor();
    const items = readTrash();
    items.push({
      id: randomId(),
      deletedAt: new Date().toISOString(),
      deletedBy: who.name,
      deletedById: who.id,
      ...item
    });
    writeTrash(items);
  }

  function replaceFunction(name, factory) {
    const current = window[name];
    if (typeof current !== 'function' || current.__rrnTrashSafe) return false;
    const replacement = factory(current);
    replacement.__rrnTrashSafe = true;
    replacement.__rrnPrevious = current;
    window[name] = replacement;
    return true;
  }

  function installSafeDelete() {
    replaceFunction('removeMaquina', () => function safeRemoveAsset(sectorIndex, assetIndex) {
      if (!canOperate()) return;
      const list = inventory();
      const sector = list[sectorIndex];
      const asset = sector?.maquinas?.[assetIndex];
      if (!asset) return;
      if (!confirm(`Mover ${asset.etiqueta || asset.nome || 'este equipamento'} para a lixeira?`)) return;

      addTrashItem({ type: 'asset', sectorName: sector.nome, asset: JSON.parse(JSON.stringify(asset)) });
      sector.maquinas.splice(assetIndex, 1);
      persistInventory();
    });

    replaceFunction('removeSetor', () => function safeRemoveSector(sectorIndex) {
      if (!canOperate()) return;
      const list = inventory();
      const sector = list[sectorIndex];
      if (!sector) return;
      const count = Array.isArray(sector.maquinas) ? sector.maquinas.length : 0;
      if (!confirm(`Mover o setor “${sector.nome}” e seus ${count} equipamento(s) para a lixeira?`)) return;

      addTrashItem({ type: 'sector', sector: JSON.parse(JSON.stringify(sector)) });
      list.splice(sectorIndex, 1);
      try { if (typeof setoresVisiveis !== 'undefined' && Array.isArray(setoresVisiveis)) setoresVisiveis.splice(sectorIndex, 1); } catch {}
      persistInventory();
    });

    replaceFunction('excluirTodosSetores', () => function safeRemoveAllSectors() {
      if (!isAdmin()) return alert('Somente administradores podem remover todos os setores.');
      const list = inventory();
      if (!list.length) return alert('Não há setores para remover.');
      if (!confirm(`Mover TODOS os ${list.length} setores para a lixeira? Eles poderão ser restaurados depois.`)) return;

      list.slice().forEach(sector => addTrashItem({ type: 'sector', sector: JSON.parse(JSON.stringify(sector)) }));
      list.splice(0, list.length);
      try { if (typeof setoresVisiveis !== 'undefined' && Array.isArray(setoresVisiveis)) setoresVisiveis.splice(0, setoresVisiveis.length); } catch {}
      persistInventory();
    });
  }

  function recordRestore(asset, sectorName) {
    const identity = asset?.id != null && String(asset.id).trim()
      ? `id:${String(asset.id)}`
      : asset?.etiqueta
        ? `tag:${String(asset.etiqueta).trim().toLowerCase()}`
        : `legacy:${String(asset?.nome || '').trim().toLowerCase()}|${String(asset?.tipo || '').trim().toLowerCase()}`;
    window.RRN_HISTORY?.recordEvent?.({
      entityType: 'asset',
      entityId: identity,
      eventType: 'restored',
      source: 'lixeira',
      title: 'Equipamento restaurado da lixeira',
      assetLabel: asset?.etiqueta || asset?.nome || 'Equipamento',
      toSector: sectorName
    });
  }

  function restoreItem(id) {
    if (!canOperate()) return;
    const items = readTrash();
    const item = items.find(entry => entry.id === id);
    if (!item) return;
    const list = inventory();

    if (item.type === 'asset') {
      let sector = list.find(entry => entry.nome === item.sectorName);
      if (!sector) {
        sector = { nome: item.sectorName || 'Restaurados', maquinas: [] };
        list.push(sector);
        try { if (typeof setoresVisiveis !== 'undefined' && Array.isArray(setoresVisiveis)) setoresVisiveis.push(true); } catch {}
      }
      if (!Array.isArray(sector.maquinas)) sector.maquinas = [];
      sector.maquinas.push(JSON.parse(JSON.stringify(item.asset)));
      recordRestore(item.asset, sector.nome);
    } else if (item.type === 'sector') {
      const restored = JSON.parse(JSON.stringify(item.sector || { nome: 'Restaurado', maquinas: [] }));
      let sector = list.find(entry => entry.nome === restored.nome);
      if (sector) {
        if (!Array.isArray(sector.maquinas)) sector.maquinas = [];
        (restored.maquinas || []).forEach(asset => {
          sector.maquinas.push(asset);
          recordRestore(asset, sector.nome);
        });
      } else {
        list.push(restored);
        try { if (typeof setoresVisiveis !== 'undefined' && Array.isArray(setoresVisiveis)) setoresVisiveis.push(true); } catch {}
        (restored.maquinas || []).forEach(asset => recordRestore(asset, restored.nome));
      }
    }

    writeTrash(items.filter(entry => entry.id !== id));
    persistInventory();
    renderTrash();
  }

  function permanentDelete(id) {
    if (!isAdmin()) return;
    if (!confirm('Excluir permanentemente este item? Esta ação não poderá ser desfeita.')) return;
    writeTrash(readTrash().filter(entry => entry.id !== id));
    renderTrash();
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
  }

  function itemLabel(item) {
    if (item.type === 'sector') return `Setor: ${item.sector?.nome || 'Sem nome'}`;
    return item.asset?.etiqueta || item.asset?.nome || 'Equipamento';
  }

  function itemDescription(item) {
    if (item.type === 'sector') {
      const count = Array.isArray(item.sector?.maquinas) ? item.sector.maquinas.length : 0;
      return `${count} equipamento(s) · removido por ${item.deletedBy || 'usuário'} em ${new Date(item.deletedAt).toLocaleString('pt-BR')}`;
    }
    return `${item.asset?.tipo || 'Equipamento'} · setor ${item.sectorName || 'não informado'} · removido por ${item.deletedBy || 'usuário'} em ${new Date(item.deletedAt).toLocaleString('pt-BR')}`;
  }

  function ensureModal() {
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'rrn-trash-modal';
    modal.innerHTML = `
      <div class="rrn-trash-dialog" role="dialog" aria-modal="true">
        <header class="rrn-trash-header">
          <div><span>Recuperação de dados</span><strong>Lixeira do inventário</strong><small>Itens removidos podem ser restaurados para o workspace atual.</small></div>
          <button type="button" class="rrn-trash-close" aria-label="Fechar">×</button>
        </header>
        <div class="rrn-trash-body" data-trash-body></div>
      </div>`;
    modal.querySelector('.rrn-trash-close').addEventListener('click', closeTrash);
    modal.addEventListener('click', event => { if (event.target === modal) closeTrash(); });
    document.body.appendChild(modal);
    return modal;
  }

  function renderTrash() {
    const host = ensureModal();
    const body = host.querySelector('[data-trash-body]');
    const items = readTrash().slice().reverse();
    if (!items.length) {
      body.innerHTML = '<div class="rrn-trash-empty"><span>🗑️</span><strong>A lixeira está vazia</strong><small>Setores e equipamentos removidos aparecerão aqui.</small></div>';
      updateCounter();
      return;
    }
    body.innerHTML = `<div class="rrn-trash-list">${items.map(item => `
      <div class="rrn-trash-item">
        <div><strong>${escapeHtml(itemLabel(item))}</strong><small>${escapeHtml(itemDescription(item))}</small></div>
        <div class="rrn-trash-actions">
          ${canOperate() ? `<button type="button" class="rrn-trash-restore" data-restore="${escapeHtml(item.id)}">Restaurar</button>` : ''}
          ${isAdmin() ? `<button type="button" class="rrn-trash-delete" data-delete="${escapeHtml(item.id)}">Excluir definitivamente</button>` : ''}
        </div>
      </div>`).join('')}</div>`;
    body.querySelectorAll('[data-restore]').forEach(button => button.addEventListener('click', () => restoreItem(button.dataset.restore)));
    body.querySelectorAll('[data-delete]').forEach(button => button.addEventListener('click', () => permanentDelete(button.dataset.delete)));
    updateCounter();
  }

  function openTrash() {
    renderTrash();
    ensureModal().classList.add('is-open');
  }

  function closeTrash() {
    modal?.classList.remove('is-open');
  }

  function updateCounter() {
    const count = readTrash().length;
    if (counterButton) counterButton.textContent = `🗑️ Lixeira (${count})`;
  }

  function injectConfigButton() {
    const right = document.querySelector('#configModal .modal-right');
    if (!right) return;
    const existing = right.querySelector('[data-rrn-trash-button]');
    if (existing) {
      counterButton = existing;
      updateCounter();
      return;
    }
    const heading = document.createElement('h3');
    heading.className = 'rrn-settings-label';
    heading.textContent = 'RECUPERAÇÃO';
    counterButton = document.createElement('button');
    counterButton.type = 'button';
    counterButton.dataset.rrnTrashButton = '1';
    counterButton.addEventListener('click', openTrash);
    right.append(heading, counterButton);
    updateCounter();
  }

  function decorateDeleteButtons() {
    document.querySelectorAll('.rrn-machine-actions .rrn-btn-danger').forEach(button => {
      button.textContent = 'Lixeira';
      button.title = 'Mover equipamento para a lixeira';
    });
  }

  function boot() {
    injectConfigButton();
    installSafeDelete();
    decorateDeleteButtons();

    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      injectConfigButton();
      installSafeDelete();
      decorateDeleteButtons();
      if (attempts >= 14) clearInterval(timer);
    }, 300);

    const container = document.getElementById('setoresContainer');
    if (container) new MutationObserver(decorateDeleteButtons).observe(container, { childList:true, subtree:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
  window.addEventListener('load', () => setTimeout(boot, 50));

  window.rrnOpenTrash = openTrash;
  window.RRN_TRASH = Object.freeze({ open: openTrash, read: readTrash, restore: restoreItem });
})();
