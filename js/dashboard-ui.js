(() => {
  'use strict';

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  function readLocalSetores() {
    if (typeof setores !== 'undefined' && Array.isArray(setores)) return setores;
    try {
      const value = JSON.parse(localStorage.getItem('setores') || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function calculateStats() {
    const lista = readLocalSetores();
    const maquinas = lista.flatMap(setor => Array.isArray(setor.maquinas) ? setor.maquinas : []);
    return {
      setores: lista.length,
      equipamentos: maquinas.length,
      manutencao: maquinas.filter(item => item?.emManutencao).length
    };
  }

  function updateOverview() {
    const overview = document.querySelector('.rrn-dashboard-overview');
    if (!overview) return;
    const stats = calculateStats();
    overview.querySelector('[data-stat="setores"]')?.replaceChildren(document.createTextNode(String(stats.setores)));
    overview.querySelector('[data-stat="equipamentos"]')?.replaceChildren(document.createTextNode(String(stats.equipamentos)));
    overview.querySelector('[data-stat="manutencao"]')?.replaceChildren(document.createTextNode(String(stats.manutencao)));
  }

  function installOverview() {
    const container = document.getElementById('setoresContainer');
    if (!container || document.querySelector('.rrn-dashboard-overview')) return;

    const overview = document.createElement('section');
    overview.className = 'rrn-dashboard-overview';
    overview.innerHTML = `
      <div class="rrn-overview-copy">
        <span>Inventário organizado por setores</span>
        <strong>Visão geral do ambiente</strong>
        <small>Abra um setor para visualizar e administrar os equipamentos que pertencem a ele.</small>
      </div>
      <div class="rrn-overview-stats" aria-label="Resumo do inventário">
        <div><span data-stat="setores">0</span><small>Setores</small></div>
        <div><span data-stat="equipamentos">0</span><small>Equipamentos</small></div>
        <div><span data-stat="manutencao">0</span><small>Manutenção</small></div>
      </div>`;

    container.parentNode.insertBefore(overview, container);
    updateOverview();

    const observer = new MutationObserver(() => updateOverview());
    observer.observe(container, { childList: true, subtree: true });
    window.addEventListener('storage', event => {
      if (event.key === 'setores') updateOverview();
    });
  }

  function settingsWorkspaceContent() {
    let local = {};
    try { local = JSON.parse(localStorage.getItem('usuarioLogado') || '{}'); } catch {}
    const tenantName = window.RRN_SESSION?.tenantName || local.tenant || 'Workspace local';
    const role = window.RRN_SESSION?.role || local.perfil || 'Acesso local';
    return { tenantName, role };
  }

  function tenantId() {
    if (window.RRN_SESSION?.tenantId) return window.RRN_SESSION.tenantId;
    try {
      return JSON.parse(localStorage.getItem('usuarioLogado') || '{}').tenant_id || 'local';
    } catch {
      return 'local';
    }
  }

  function appearanceKey() {
    return `dashboardBgConfig_${tenantId()}`;
  }

  function readAppearance() {
    try {
      const parsed = JSON.parse(localStorage.getItem(appearanceKey()) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveAppearance(next) {
    const current = readAppearance();
    const value = { ...current, ...next };
    localStorage.setItem(appearanceKey(), JSON.stringify(value));
    return value;
  }

  function applyAppearance(config = readAppearance()) {
    if (config.imagem) {
      document.body.style.backgroundImage = `url('${config.imagem}')`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundRepeat = 'no-repeat';
      document.body.style.backgroundPosition = 'center center';
    } else {
      document.body.style.backgroundImage = 'none';
      if (config.cor) document.body.style.backgroundColor = config.cor;
    }

    const picker = document.getElementById('bgColorPicker');
    if (picker && config.cor) picker.value = config.cor;
  }

  function migrateLegacyAppearance() {
    if (localStorage.getItem(appearanceKey())) return;
    const legacyImage = localStorage.getItem('dashboardBgImage');
    const legacyColor = localStorage.getItem('dashboardBgColor');
    if (!legacyImage && !legacyColor) return;

    saveAppearance({
      imagem: legacyImage || null,
      cor: legacyImage ? null : legacyColor
    });
  }

  function bindAppearanceControls() {
    const picker = document.getElementById('bgColorPicker');
    const urlInput = document.getElementById('bgImageUrl');
    const applyUrl = document.getElementById('applyBgImageUrlBtn');
    const uploadInput = document.getElementById('bgImageUpload');
    const applyUpload = document.getElementById('applyBgUploadBtn');

    if (picker && !picker.dataset.rrnBound) {
      picker.dataset.rrnBound = '1';
      picker.addEventListener('input', event => {
        const config = saveAppearance({ cor: event.target.value, imagem: null });
        applyAppearance(config);
      });
    }

    if (applyUrl && !applyUrl.dataset.rrnBound) {
      applyUrl.dataset.rrnBound = '1';
      applyUrl.addEventListener('click', () => {
        const url = urlInput?.value.trim();
        if (!url) return;
        const config = saveAppearance({ imagem: url, cor: null });
        applyAppearance(config);
      });
    }

    if (applyUpload && uploadInput && !applyUpload.dataset.rrnBound) {
      applyUpload.dataset.rrnBound = '1';
      applyUpload.addEventListener('click', () => {
        const file = uploadInput.files?.[0];
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = event => {
          const config = saveAppearance({ imagem: event.target.result, cor: null });
          applyAppearance(config);
          if (urlInput) urlInput.value = '';
        };
        reader.readAsDataURL(file);
      });
    }
  }

  function enhanceSettings() {
    const modal = document.getElementById('configModal');
    if (!modal) return;

    modal.classList.add('rrn-settings');

    const title = modal.querySelector('.modal-title');
    if (title && !modal.querySelector('.rrn-settings-subtitle')) {
      const subtitle = document.createElement('p');
      subtitle.className = 'rrn-settings-subtitle';
      subtitle.textContent = 'Personalize o RRN Manager e gerencie importação, exportação e backup dos dados.';
      title.after(subtitle);
    }

    const left = modal.querySelector('.modal-left');
    if (left) {
      let workspace = left.querySelector('.rrn-workspace-card');
      if (!workspace) {
        workspace = document.createElement('div');
        workspace.className = 'rrn-workspace-card';
        left.appendChild(workspace);
      }
      const data = settingsWorkspaceContent();
      workspace.innerHTML = `
        <span>Workspace ativo</span>
        <strong>${escapeHtml(data.tenantName)}</strong>
        <small>${escapeHtml(data.role)} · contexto atual do inventário</small>`;
    }

    const right = modal.querySelector('.modal-right');
    if (right) {
      right.classList.add('rrn-settings-content');
      right.querySelectorAll(':scope > h3').forEach(heading => heading.classList.add('rrn-settings-label'));
      const background = right.querySelector('.box-bg-selector');
      if (background) background.classList.add('rrn-appearance-card');
    }

    const save = document.querySelector('.save-btn');
    if (save) {
      save.textContent = 'Concluir';
      save.classList.add('rrn-settings-save');
      if (save.parentElement !== modal) modal.appendChild(save);
    }

    migrateLegacyAppearance();
    bindAppearanceControls();
    applyAppearance();
  }

  function normalizeActionClasses() {
    document.querySelectorAll('button[onclick*="abrirModalTransferencia"]').forEach(button => {
      button.classList.add('operador-only', 'rrn-top-action');
    });
    document.getElementById('addSetorBtn')?.classList.add('rrn-top-action', 'rrn-top-action-primary');
  }

  function boot() {
    enhanceSettings();
    installOverview();
    normalizeActionClasses();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.addEventListener('load', () => {
    enhanceSettings();
    updateOverview();
  });

  window.RRN_UI = Object.freeze({
    updateOverview,
    enhanceSettings,
    applyAppearance
  });
})();
