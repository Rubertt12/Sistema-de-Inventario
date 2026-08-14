(() => {
  'use strict';
  if (window.__RRN_INVENTORY_SNAPSHOTS__) return;
  window.__RRN_INVENTORY_SNAPSHOTS__ = true;

  let historyModal = null;
  let confirmModal = null;

  function currentRole() {
    if (window.RRN_SESSION?.role) return window.RRN_SESSION.role;
    try { return JSON.parse(localStorage.getItem('usuarioLogado') || '{}').perfil || null; }
    catch { return null; }
  }

  function isAdmin() {
    return currentRole() === 'admin';
  }

  function client() {
    return window.RRN_SUPABASE_CLIENT || null;
  }

  function formatDate(value, withTime = true) {
    if (!value) return 'Data não informada';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('pt-BR', withTime
      ? { dateStyle: 'short', timeStyle: 'short' }
      : { dateStyle: 'short' }).format(date);
  }

  function saoPauloDate() {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date());
    const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${map.year}-${map.month}-${map.day}`;
  }

  function sourceLabel(source) {
    return ({
      automatic: 'Automático',
      manual: 'Manual',
      pre_restore: 'Antes da restauração'
    })[source] || 'Versão';
  }

  function setBusy(button, busy, busyLabel = 'Processando...') {
    if (!button) return;
    if (busy) {
      button.dataset.rrnOriginalText = button.textContent || '';
      button.disabled = true;
      button.textContent = busyLabel;
    } else {
      button.disabled = false;
      button.textContent = button.dataset.rrnOriginalText || button.textContent || '';
      delete button.dataset.rrnOriginalText;
      button.dataset.rrnSvgIcon = '';
      window.RRN_ICONS?.decorateStatic?.(button);
    }
  }

  function ensureSettingsCard() {
    const modal = document.getElementById('configModal');
    if (!modal) return null;
    const existing = modal.querySelector('[data-inventory-versioning-card]');
    if (!isAdmin()) {
      existing?.remove();
      return null;
    }
    if (existing) return existing;

    const right = modal.querySelector('.modal-right') || modal;
    const card = document.createElement('section');
    card.className = 'rrn-versioning-card admin-only';
    card.dataset.inventoryVersioningCard = '1';
    card.innerHTML = `
      <div class="rrn-versioning-head">
        <div>
          <strong>Backup e versionamento</strong>
          <small>O inventário recebe um snapshot automático diário. Versões automáticas são mantidas por 90 dias.</small>
        </div>
        <span class="rrn-versioning-status">Protegido</span>
      </div>
      <div class="rrn-versioning-actions">
        <button type="button" class="rrn-admin-btn" data-snapshot-create data-rrn-icon="save">Criar snapshot agora</button>
        <button type="button" class="rrn-admin-btn" data-snapshot-yesterday data-rrn-icon="refresh">Restaurar estado anterior</button>
        <button type="button" class="rrn-admin-btn" data-snapshot-history data-rrn-icon="clock">Ver versões</button>
      </div>
      <div class="rrn-versioning-meta" data-snapshot-meta>Carregando última versão...</div>`;

    const appearance = right.querySelector('.box-bg-selector');
    if (appearance) right.insertBefore(card, appearance);
    else right.appendChild(card);

    card.querySelector('[data-snapshot-create]')?.addEventListener('click', createManualSnapshot);
    card.querySelector('[data-snapshot-yesterday]')?.addEventListener('click', restorePreviousDay);
    card.querySelector('[data-snapshot-history]')?.addEventListener('click', openHistory);
    window.RRN_ICONS?.decorateStatic?.(card);
    refreshMeta();
    return card;
  }

  async function refreshMeta() {
    const host = document.querySelector('[data-snapshot-meta]');
    if (!host || !isAdmin()) return;
    const db = client();
    if (!db) return;

    try {
      const { data, error } = await db
        .from('tenant_inventory_snapshots')
        .select('id,captured_at,source')
        .order('captured_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      host.textContent = data
        ? `Última versão: ${formatDate(data.captured_at)} · ${sourceLabel(data.source)}`
        : 'O versionamento foi ativado e aguardará a primeira alteração do inventário.';
    } catch (error) {
      console.warn('RRN snapshots meta:', error);
      host.textContent = 'Não foi possível consultar as versões agora.';
    }
  }

  async function createManualSnapshot(event) {
    if (!isAdmin()) return;
    const button = event?.currentTarget;
    const db = client();
    if (!db) return alert('A conexão com o banco ainda não está pronta.');
    setBusy(button, true, 'Salvando...');
    try {
      const { error } = await db.rpc('create_inventory_snapshot', { p_note: 'Snapshot manual criado pelo administrador' });
      if (error) throw error;
      await refreshMeta();
      await renderHistory();
    } catch (error) {
      console.warn('RRN manual snapshot:', error);
      alert(`Não foi possível criar o snapshot: ${error.message || 'erro inesperado'}`);
    } finally {
      setBusy(button, false);
    }
  }

  function ensureHistoryModal() {
    if (historyModal) return historyModal;
    historyModal = document.createElement('div');
    historyModal.id = 'rrnSnapshotHistoryModal';
    historyModal.className = 'rrn-admin-tools-modal';
    historyModal.hidden = true;
    historyModal.innerHTML = `
      <div class="rrn-admin-tools-card" role="dialog" aria-modal="true" aria-labelledby="rrnSnapshotHistoryTitle">
        <div class="rrn-admin-tools-head">
          <div class="rrn-admin-tools-title">
            <span>Proteção de dados</span>
            <h3 id="rrnSnapshotHistoryTitle">Versões do inventário</h3>
            <p>Restaure uma versão anterior sem perder o estado atual: antes da restauração o sistema cria automaticamente uma cópia de segurança.</p>
          </div>
          <button type="button" class="rrn-admin-tools-close" data-snapshot-history-close aria-label="Fechar">×</button>
        </div>
        <div class="rrn-admin-tools-body">
          <div class="rrn-snapshot-list" data-snapshot-list></div>
        </div>
        <div class="rrn-admin-tools-footer">
          <span class="rrn-versioning-meta">Snapshots automáticos: retenção de 90 dias.</span>
          <div class="rrn-admin-tools-footer-group">
            <button type="button" class="rrn-admin-btn" data-snapshot-history-refresh data-rrn-icon="refresh">Atualizar</button>
            <button type="button" class="rrn-admin-btn primary" data-snapshot-history-close>Concluir</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(historyModal);
    historyModal.querySelectorAll('[data-snapshot-history-close]').forEach(button => button.addEventListener('click', closeHistory));
    historyModal.querySelector('[data-snapshot-history-refresh]')?.addEventListener('click', renderHistory);
    historyModal.addEventListener('click', event => { if (event.target === historyModal) closeHistory(); });
    window.RRN_ICONS?.decorateStatic?.(historyModal);
    return historyModal;
  }

  async function openHistory() {
    if (!isAdmin()) return;
    const modal = ensureHistoryModal();
    modal.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    await renderHistory();
  }

  function closeHistory() {
    if (historyModal) historyModal.hidden = true;
    document.documentElement.style.removeProperty('overflow');
  }

  async function renderHistory() {
    if (!historyModal || historyModal.hidden || !isAdmin()) return;
    const list = historyModal.querySelector('[data-snapshot-list]');
    const db = client();
    if (!list || !db) return;
    list.innerHTML = '<div class="rrn-snapshot-empty">Carregando versões...</div>';

    try {
      const { data, error } = await db
        .from('tenant_inventory_snapshots')
        .select('id,snapshot_day,captured_at,source,note')
        .order('captured_at', { ascending: false })
        .limit(30);
      if (error) throw error;

      if (!data?.length) {
        list.innerHTML = '<div class="rrn-snapshot-empty">Ainda não existem versões anteriores deste inventário.</div>';
        return;
      }

      list.innerHTML = data.map(item => `
        <article class="rrn-snapshot-item" data-snapshot-id="${item.id}">
          <div class="rrn-snapshot-main">
            <strong>${formatDate(item.captured_at)} <span class="rrn-snapshot-tag">${sourceLabel(item.source)}</span></strong>
            <small>${item.note ? escapeHtml(item.note) : item.source === 'automatic' ? 'Snapshot diário automático do inventário.' : 'Versão preservada do inventário.'}</small>
          </div>
          <button type="button" class="rrn-admin-btn" data-snapshot-restore="${item.id}" data-rrn-icon="refresh">Restaurar</button>
        </article>`).join('');

      list.querySelectorAll('[data-snapshot-restore]').forEach(button => {
        button.addEventListener('click', () => {
          const item = data.find(row => String(row.id) === button.dataset.snapshotRestore);
          if (item) requestRestore(item);
        });
      });
      window.RRN_ICONS?.decorateStatic?.(list);
    } catch (error) {
      console.warn('RRN snapshot history:', error);
      list.innerHTML = `<div class="rrn-snapshot-empty">Não foi possível carregar as versões: ${escapeHtml(error.message || 'erro inesperado')}</div>`;
    }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  function ensureConfirmModal() {
    if (confirmModal) return confirmModal;
    confirmModal = document.createElement('div');
    confirmModal.id = 'rrnSnapshotConfirmModal';
    confirmModal.className = 'rrn-admin-tools-modal';
    confirmModal.hidden = true;
    confirmModal.innerHTML = `
      <div class="rrn-admin-tools-card" role="alertdialog" aria-modal="true" aria-labelledby="rrnSnapshotConfirmTitle" style="width:min(560px,96vw)">
        <div class="rrn-admin-tools-head">
          <div class="rrn-admin-tools-title">
            <span>Confirmar restauração</span>
            <h3 id="rrnSnapshotConfirmTitle">Restaurar esta versão?</h3>
          </div>
          <button type="button" class="rrn-admin-tools-close" data-snapshot-confirm-cancel aria-label="Cancelar">×</button>
        </div>
        <div class="rrn-admin-tools-body">
          <div class="rrn-confirm-copy" data-snapshot-confirm-copy></div>
        </div>
        <div class="rrn-admin-tools-footer">
          <span class="rrn-versioning-meta">O estado atual será salvo antes da restauração.</span>
          <div class="rrn-admin-tools-footer-group">
            <button type="button" class="rrn-admin-btn" data-snapshot-confirm-cancel>Cancelar</button>
            <button type="button" class="rrn-admin-btn danger" data-snapshot-confirm-ok data-rrn-icon="refresh">Restaurar versão</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(confirmModal);
    window.RRN_ICONS?.decorateStatic?.(confirmModal);
    return confirmModal;
  }

  function requestRestore(snapshot) {
    if (!snapshot || !isAdmin()) return;
    const modal = ensureConfirmModal();
    modal.querySelector('[data-snapshot-confirm-copy]').innerHTML = `
      Você está prestes a substituir o inventário atual pela versão de <strong>${formatDate(snapshot.captured_at)}</strong>.
      Setores, equipamentos, chamados, histórico e lixeira voltarão ao estado armazenado nesse snapshot.`;

    const cancel = () => { modal.hidden = true; };
    modal.querySelectorAll('[data-snapshot-confirm-cancel]').forEach(button => button.onclick = cancel);
    const ok = modal.querySelector('[data-snapshot-confirm-ok]');
    ok.onclick = () => restoreSnapshot(snapshot, ok);
    modal.hidden = false;
  }

  async function restoreSnapshot(snapshot, button) {
    const db = client();
    if (!db || !snapshot?.id) return;
    setBusy(button, true, 'Restaurando...');
    try {
      const { error } = await db.rpc('restore_inventory_snapshot', { p_snapshot_id: snapshot.id });
      if (error) throw error;
      if (confirmModal) confirmModal.hidden = true;
      if (historyModal) historyModal.hidden = true;
      await window.RRN_REMOTE_SYNC?.refresh?.();
      setTimeout(() => location.reload(), 180);
    } catch (error) {
      console.warn('RRN restore snapshot:', error);
      alert(`Não foi possível restaurar a versão: ${error.message || 'erro inesperado'}`);
      setBusy(button, false);
    }
  }

  async function restorePreviousDay(event) {
    if (!isAdmin()) return;
    const button = event?.currentTarget;
    const db = client();
    if (!db) return alert('A conexão com o banco ainda não está pronta.');
    setBusy(button, true, 'Buscando...');
    try {
      const today = saoPauloDate();
      const { data, error } = await db
        .from('tenant_inventory_snapshots')
        .select('id,snapshot_day,captured_at,source,note')
        .eq('source', 'automatic')
        .lt('snapshot_day', today)
        .order('snapshot_day', { ascending: false })
        .order('captured_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        alert('Ainda não existe um snapshot de um dia anterior. O versionamento começa a registrar as versões a partir de agora.');
        return;
      }
      requestRestore(data);
    } catch (error) {
      console.warn('RRN previous snapshot:', error);
      alert(`Não foi possível localizar uma versão anterior: ${error.message || 'erro inesperado'}`);
    } finally {
      setBusy(button, false);
    }
  }

  function boot() {
    ensureSettingsCard();
    window.addEventListener('rrn:session-ready', () => {
      ensureSettingsCard();
      refreshMeta();
    });
    window.addEventListener('rrn:inventory-remote-update', refreshMeta);
    window.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      if (confirmModal && !confirmModal.hidden) confirmModal.hidden = true;
      else if (historyModal && !historyModal.hidden) closeHistory();
    });
  }

  window.RRN_INVENTORY_SNAPSHOTS = Object.freeze({
    openHistory,
    refresh: refreshMeta,
    createManual: createManualSnapshot
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
