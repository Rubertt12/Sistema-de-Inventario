(() => {
  'use strict';

  function safeParse(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function currentTenant() {
    return window.RRN_SESSION?.tenantId || safeParse('usuarioLogado', {})?.tenant_id || null;
  }

  function inventoryData() {
    try {
      if (typeof setores !== 'undefined' && Array.isArray(setores)) return setores;
    } catch {}
    return safeParse('setores', []);
  }

  function downloadJson(payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `rrn-manager-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function exportBackup() {
    downloadJson({
      product: 'RRN Manager',
      version: 3,
      exportedAt: new Date().toISOString(),
      tenantId: currentTenant(),
      setores: inventoryData(),
      chamados: safeParse('chamados', []),
      asset_history: safeParse('asset_history', [])
    });
  }

  function validateBackup(data) {
    if (!data || typeof data !== 'object') throw new Error('Arquivo JSON inválido.');
    if (!Array.isArray(data.setores)) throw new Error('O backup não contém uma lista válida de setores.');
    if (data.tenantId && currentTenant() && data.tenantId !== currentTenant()) {
      const ok = confirm('Este backup foi criado em outro workspace. Deseja importar mesmo assim para o workspace atual?');
      if (!ok) throw new Error('Importação cancelada para evitar mistura entre tenants.');
    }
  }

  function importBackup(event) {
    const file = event?.target?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        validateBackup(data);

        localStorage.setItem('setores', JSON.stringify(data.setores));
        localStorage.setItem('chamados', JSON.stringify(Array.isArray(data.chamados) ? data.chamados : []));
        localStorage.setItem('asset_history', JSON.stringify(Array.isArray(data.asset_history) ? data.asset_history : []));

        alert('Backup restaurado com setores, equipamentos, chamados e histórico de alterações.');
        location.reload();
      } catch (error) {
        if (!/cancelada/i.test(error.message || '')) alert(`Não foi possível importar o backup: ${error.message}`);
      } finally {
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  }

  function install() {
    window.exportarBackupJSON = exportBackup;
    window.importarBackupJSON = importBackup;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
  window.addEventListener('load', install);
})();
