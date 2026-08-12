(() => {
  'use strict';
  if (window.__RRN_SETTINGS_PAGE__) return;
  window.__RRN_SETTINGS_PAGE__ = true;

  const $ = id => document.getElementById(id);
  const $$ = selector => Array.from(document.querySelectorAll(selector));

  const safeParse = (key, fallback) => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value ?? fallback;
    } catch {
      return fallback;
    }
  };

  function localUser() {
    return safeParse('usuarioLogado', {}) || {};
  }

  function sessionContext() {
    const local = localUser();
    const session = window.RRN_SESSION || {};
    return {
      userId: session.userId || local.id || null,
      name: session.name || session.userName || local.nome || local.name || 'Usuário',
      email: session.email || local.email || '',
      role: session.role || local.perfil || local.role || 'usuário',
      tenantId: session.tenantId || local.tenant_id || local.tenantId || 'local',
      tenantName: session.tenantName || local.tenant || local.tenantName || 'Workspace local',
      demo: Boolean(session.demo || local.demo)
    };
  }

  function roleLabel(role) {
    return { admin: 'Administrador', operador: 'Operador', monitoramento: 'Monitoramento' }[String(role || '').toLowerCase()] || role || 'Usuário';
  }

  function toast(message, type = '') {
    const el = $('settingsToast');
    if (!el) return;
    el.textContent = message;
    el.classList.toggle('error', type === 'error');
    el.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { el.hidden = true; }, 2600);
  }

  function inventory() {
    const value = safeParse('setores', []);
    return Array.isArray(value) ? value : [];
  }

  function refreshKpis() {
    const sectors = inventory();
    const assets = sectors.flatMap(sector => Array.isArray(sector?.maquinas) ? sector.maquinas : []);
    const history = safeParse('asset_history', []);
    if ($('settingsKpiSectors')) $('settingsKpiSectors').textContent = String(sectors.length);
    if ($('settingsKpiAssets')) $('settingsKpiAssets').textContent = String(assets.length);
    if ($('settingsKpiMaintenance')) $('settingsKpiMaintenance').textContent = String(assets.filter(asset => asset?.emManutencao).length);
    if ($('settingsKpiHistory')) $('settingsKpiHistory').textContent = String(Array.isArray(history) ? history.length : 0);
  }

  function updateContext() {
    const ctx = sessionContext();
    if ($('settingsSidebarName')) $('settingsSidebarName').textContent = ctx.name;
    if ($('settingsSidebarWorkspace')) $('settingsSidebarWorkspace').textContent = ctx.tenantName;
    if ($('settingsProfileName')) $('settingsProfileName').textContent = ctx.name;
    if ($('settingsProfileEmail')) $('settingsProfileEmail').textContent = ctx.email || 'E-mail não disponível';
    if ($('settingsWorkspaceName')) $('settingsWorkspaceName').textContent = ctx.tenantName;
    if ($('settingsRole')) $('settingsRole').textContent = roleLabel(ctx.role);
    if ($('settingsTenantId')) $('settingsTenantId').textContent = ctx.tenantId === 'local' ? 'Contexto local' : `Tenant ${String(ctx.tenantId).slice(0, 8)}…`;
    if ($('settingsSessionPill')) {
      $('settingsSessionPill').textContent = ctx.demo ? 'Modo demonstração' : `${roleLabel(ctx.role)} · conectado`;
      $('settingsSessionPill').classList.add('ready');
    }
    if ($('securitySessionText')) $('securitySessionText').textContent = `${ctx.name} · ${ctx.email || ctx.tenantName} · ${roleLabel(ctx.role)}`;

    const admin = String(ctx.role).toLowerCase() === 'admin';
    if ($('settingsAdminNav')) $('settingsAdminNav').hidden = !admin;
    if ($('settingsAdminPanel') && !admin && $('settingsAdminPanel').classList.contains('active')) activatePanel('general');
    refreshKpis();
  }

  function activatePanel(name) {
    const requested = name || 'general';
    const nav = document.querySelector(`[data-settings-nav="${CSS.escape(requested)}"]`);
    if (!nav || nav.hidden) return activatePanel('general');

    $$('[data-settings-nav]').forEach(button => {
      const active = button.dataset.settingsNav === requested;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
    $$('[data-settings-panel]').forEach(panel => {
      const active = panel.dataset.settingsPanel === requested;
      panel.classList.toggle('active', active);
      panel.hidden = !active;
    });
    history.replaceState(null, '', `#${requested}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function bindNavigation() {
    $$('[data-settings-nav]').forEach(button => {
      button.addEventListener('click', () => activatePanel(button.dataset.settingsNav));
    });
    const initial = location.hash.replace('#', '').trim();
    activatePanel(initial || 'general');
  }

  function profileStorageKey() {
    const id = sessionContext().userId;
    return id ? `userProfileImage_${id}` : 'userProfileImage';
  }

  function bindProfile() {
    $('profilePicInput')?.addEventListener('change', event => {
      if (typeof window.changeProfilePicture === 'function') {
        window.changeProfilePicture(event);
        setTimeout(() => toast('Foto de perfil atualizada.'), 50);
        return;
      }
      const file = event.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/') || file.size > 2 * 1024 * 1024) return toast('Selecione uma imagem válida de até 2 MB.', 'error');
      const reader = new FileReader();
      reader.onload = () => {
        localStorage.setItem(profileStorageKey(), reader.result);
        if ($('profilePic')) $('profilePic').src = reader.result;
        if ($('userAvatar')) $('userAvatar').src = reader.result;
        toast('Foto de perfil atualizada.');
      };
      reader.readAsDataURL(file);
    });

    $('removeProfilePicBtn')?.addEventListener('click', () => {
      localStorage.removeItem(profileStorageKey());
      localStorage.removeItem('userProfileImage');
      if ($('profilePic')) $('profilePic').src = '/img/avatar.webp';
      if ($('userAvatar')) $('userAvatar').src = '/img/avatar.webp';
      if ($('profilePicInput')) $('profilePicInput').value = '';
      toast('Avatar padrão restaurado.');
    });
  }

  function appearanceKey() {
    return `dashboardBgConfig_${sessionContext().tenantId || 'local'}`;
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
    const merged = { ...readAppearance(), ...next };
    localStorage.setItem(appearanceKey(), JSON.stringify(merged));
    renderAppearance(merged);
    return merged;
  }

  function migrateLegacyAppearance() {
    if (localStorage.getItem(appearanceKey())) return;
    const legacyImage = localStorage.getItem('dashboardBgImage');
    const legacyColor = localStorage.getItem('dashboardBgColor');
    if (!legacyImage && !legacyColor) return;
    localStorage.setItem(appearanceKey(), JSON.stringify({ imagem: legacyImage || null, cor: legacyImage ? null : legacyColor, layout: 'grid' }));
  }

  function renderAppearance(config = readAppearance()) {
    const layout = config.layout === 'list' ? 'list' : 'grid';
    $$('[data-layout-choice]').forEach(button => button.classList.toggle('active', button.dataset.layoutChoice === layout));

    const color = config.cor || '#EEF2F3';
    if ($('bgColorPicker')) $('bgColorPicker').value = color;
    if ($('bgColorValue')) $('bgColorValue').textContent = color.toUpperCase();

    const preview = $('backgroundPreview');
    if (preview) {
      preview.style.backgroundColor = config.cor || 'var(--rrn-bg)';
      preview.style.backgroundImage = config.imagem ? `url("${String(config.imagem).replace(/"/g, '%22')}")` : 'none';
    }

    const mode = document.documentElement.dataset.theme || window.RRN_THEME?.get?.() || localStorage.getItem('rrn_theme_mode') || 'light';
    $$('[data-theme-choice]').forEach(button => button.classList.toggle('active', button.dataset.themeChoice === mode));
  }

  function bindAppearance() {
    $$('[data-theme-choice]').forEach(button => button.addEventListener('click', () => {
      const mode = button.dataset.themeChoice;
      if (window.RRN_THEME?.set) window.RRN_THEME.set(mode);
      else {
        document.documentElement.dataset.theme = mode;
        localStorage.setItem('rrn_theme_mode', mode);
      }
      renderAppearance();
      toast(`Tema ${mode === 'dark' ? 'escuro' : 'claro'} aplicado.`);
    }));

    $$('[data-layout-choice]').forEach(button => button.addEventListener('click', () => {
      saveAppearance({ layout: button.dataset.layoutChoice });
      toast(`Visualização em ${button.dataset.layoutChoice === 'list' ? 'lista' : 'grade'} selecionada.`);
    }));

    $('bgColorPicker')?.addEventListener('input', event => {
      saveAppearance({ cor: event.target.value, imagem: null });
      if ($('bgImageUrl')) $('bgImageUrl').value = '';
    });
    $('bgColorPicker')?.addEventListener('change', () => toast('Cor da dashboard atualizada.'));

    $('applyBgImageUrlBtn')?.addEventListener('click', () => {
      const url = $('bgImageUrl')?.value.trim();
      if (!url) return toast('Informe uma URL de imagem.', 'error');
      if (!/^https?:\/\//i.test(url) && !/^data:image\//i.test(url)) return toast('Use uma URL http/https válida.', 'error');
      saveAppearance({ imagem: url, cor: null });
      toast('Imagem de fundo aplicada.');
    });

    $('bgImageUpload')?.addEventListener('change', event => {
      const file = event.target.files?.[0];
      if ($('bgUploadName')) $('bgUploadName').textContent = file ? file.name : 'Nenhum arquivo selecionado';
    });

    $('applyBgUploadBtn')?.addEventListener('click', () => {
      const file = $('bgImageUpload')?.files?.[0];
      if (!file || !file.type.startsWith('image/')) return toast('Selecione uma imagem válida.', 'error');
      if (file.size > 2 * 1024 * 1024) return toast('Para evitar estourar o armazenamento do navegador, use uma imagem de até 2 MB.', 'error');
      const reader = new FileReader();
      reader.onload = () => {
        saveAppearance({ imagem: reader.result, cor: null });
        if ($('bgImageUrl')) $('bgImageUrl').value = '';
        toast('Imagem local aplicada à dashboard.');
      };
      reader.readAsDataURL(file);
    });

    $('resetAppearanceBtn')?.addEventListener('click', () => {
      localStorage.removeItem(appearanceKey());
      if ($('bgImageUrl')) $('bgImageUrl').value = '';
      if ($('bgImageUpload')) $('bgImageUpload').value = '';
      if ($('bgUploadName')) $('bgUploadName').textContent = 'Nenhum arquivo selecionado';
      renderAppearance({ layout: 'grid', cor: null, imagem: null });
      toast('Aparência padrão restaurada.');
    });

    window.addEventListener('rrn:themechange', () => renderAppearance());
  }

  function csvEscape(value) {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
  }

  function normalizeTickets(machine) {
    const source = Array.isArray(machine?.chamados) ? machine.chamados : (Array.isArray(machine?.chamado) ? machine.chamado : []);
    return source.map(ticket => ({
      texto: ticket?.texto ?? ticket?.observacao ?? '',
      prioridade: ticket?.prioridade ?? 'Baixa',
      data: ticket?.data ?? null,
      atualizadoEm: ticket?.atualizadoEm ?? null,
      interacoes: Array.isArray(ticket?.interacoes) ? ticket.interacoes : []
    }));
  }

  function exportCsv() {
    const header = ['Setor','Tipo','Número de Série / Nome','Etiqueta','Em Manutenção','Início da Manutenção','Usuário','Chamados JSON','ID','Fabricante','Modelo','Localização','Situação Patrimonial','Data da Compra','Garantia Até','Observações do Ativo'];
    const rows = [header.map(csvEscape).join(';')];
    inventory().forEach(sector => {
      (Array.isArray(sector?.maquinas) ? sector.maquinas : []).forEach(machine => {
        const maintenance = machine?.tempoManutencao ? new Date(machine.tempoManutencao) : null;
        const maintenanceValue = maintenance && !Number.isNaN(maintenance.getTime()) ? maintenance.toISOString() : (machine?.tempoManutencao || '');
        rows.push([
          sector?.nome || '', machine?.tipo || '', machine?.numeroSerie || machine?.nome || '', machine?.etiqueta || '',
          Boolean(machine?.emManutencao), maintenanceValue, machine?.usuarioResponsavel || '', JSON.stringify(normalizeTickets(machine)),
          machine?.id || '', machine?.fabricante || '', machine?.modelo || '', machine?.localizacao || '', machine?.situacaoPatrimonial || 'ativo',
          machine?.dataCompra || '', machine?.garantiaAte || '', machine?.observacoesAtivo || ''
        ].map(csvEscape).join(';'));
      });
    });
    const blob = new Blob(['\uFEFF', rows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rrn-manager-inventario-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast('CSV exportado.');
  }

  function parseCsvLine(line) {
    const cells = [];
    let value = '';
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        if (quoted && line[i + 1] === '"') { value += '"'; i += 1; }
        else quoted = !quoted;
      } else if (char === ';' && !quoted) {
        cells.push(value); value = '';
      } else value += char;
    }
    cells.push(value);
    return cells;
  }

  function parseTickets(raw) {
    const text = String(raw || '').trim();
    if (!text || text === 'Nenhuma Observação') return [];
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    return text.split(' | ').map(entry => ({ texto: entry.split(' - Prioridade: ')[0]?.trim() || '', prioridade: entry.split(' - Prioridade: ')[1]?.trim() || 'Baixa', data: new Date().toISOString(), interacoes: [] })).filter(ticket => ticket.texto);
  }

  function parseMaintenance(raw, enabled) {
    if (!enabled || !raw) return 0;
    const numeric = Number(raw);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
    const timestamp = Date.parse(raw);
    return Number.isNaN(timestamp) ? Date.now() : timestamp;
  }

  function safeId(value) {
    const trimmed = String(value || '').trim();
    if (trimmed) return trimmed;
    return crypto?.randomUUID?.() || `asset_${Date.now()}_${Math.random().toString(36).slice(2,9)}`;
  }

  function importCsv(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const content = String(reader.result || '').replace(/^\uFEFF/, '');
        const lines = content.split(/\r?\n/).filter(line => line.trim());
        if (lines.length < 2) throw new Error('O CSV não contém registros para importar.');
        const header = parseCsvLine(lines[0]).map(value => value.trim());
        const modern = header.includes('Chamados JSON') || header.includes('Fabricante');
        const nextSectors = [];

        lines.slice(1).forEach(line => {
          const cells = parseCsvLine(line);
          if (cells.length < 4) return;
          const sectorName = String(cells[0] || '').trim();
          if (!sectorName) return;
          let sector = nextSectors.find(item => item.nome === sectorName);
          if (!sector) { sector = { nome: sectorName, maquinas: [] }; nextSectors.push(sector); }
          const maintenance = String(cells[4] || '').trim().toLowerCase() === 'true';
          const tickets = parseTickets(cells[7]);
          sector.maquinas.push({
            id: safeId(modern ? cells[8] : cells[8]),
            nome: String(cells[2] || '').trim() || 'Sem nome',
            tipo: String(cells[1] || '').trim() || 'Equipamento',
            etiqueta: String(cells[3] || '').trim(),
            chamado: tickets,
            chamados: tickets,
            emManutencao: maintenance,
            tempoManutencao: parseMaintenance(cells[5], maintenance),
            usuarioResponsavel: String(cells[6] || '').trim(),
            fabricante: modern ? String(cells[9] || '').trim() : '',
            modelo: modern ? String(cells[10] || '').trim() : '',
            localizacao: modern ? String(cells[11] || '').trim() : '',
            situacaoPatrimonial: modern ? String(cells[12] || 'ativo').trim() : 'ativo',
            dataCompra: modern ? String(cells[13] || '').trim() : '',
            garantiaAte: modern ? String(cells[14] || '').trim() : '',
            observacoesAtivo: modern ? String(cells[15] || '').trim() : '',
            atualizadoEm: new Date().toISOString()
          });
        });
        if (!nextSectors.length) throw new Error('Nenhum setor válido foi encontrado no CSV.');
        if (!confirm(`A importação substituirá o inventário atual por ${nextSectors.length} setor(es). Continuar?`)) return;
        localStorage.setItem('setores', JSON.stringify(nextSectors));
        refreshKpis();
        toast(`CSV importado: ${nextSectors.length} setor(es).`);
      } catch (error) {
        toast(error.message || 'Falha ao importar o CSV.', 'error');
      } finally {
        event.target.value = '';
      }
    };
    reader.readAsText(file, 'UTF-8');
  }

  function bindData() {
    $('exportBackupBtn')?.addEventListener('click', () => {
      if (typeof window.exportarBackupJSON === 'function') window.exportarBackupJSON();
      else toast('O módulo de backup não carregou.', 'error');
    });
    $('importBackupBtn')?.addEventListener('click', () => $('jsonInput')?.click());
    $('jsonInput')?.addEventListener('change', event => {
      if (typeof window.importarBackupJSON === 'function') window.importarBackupJSON(event);
      else toast('O módulo de backup não carregou.', 'error');
    });
    $('exportCsvBtn')?.addEventListener('click', exportCsv);
    $('importCsvBtn')?.addEventListener('click', () => $('csvInputSettings')?.click());
    $('csvInputSettings')?.addEventListener('change', importCsv);
  }

  function bindSecurity() {
    $('changePasswordBtn')?.addEventListener('click', () => {
      if (typeof window.openPasswordChangeModal === 'function') window.openPasswordChangeModal();
      else toast('O gerenciador de senha ainda não carregou.', 'error');
    });
    $('logoutSettingsBtn')?.addEventListener('click', async () => {
      if (window.RRN_SECURE_LOGOUT) return window.RRN_SECURE_LOGOUT();
      localStorage.removeItem('usuarioLogado');
      location.replace('/index.html');
    });
  }

  function boot() {
    migrateLegacyAppearance();
    bindNavigation();
    bindProfile();
    bindAppearance();
    bindData();
    bindSecurity();
    updateContext();
    renderAppearance();
    refreshKpis();
  }

  window.addEventListener('rrn:session-ready', () => {
    updateContext();
    renderAppearance();
  });
  window.addEventListener('storage', event => {
    if (['setores','asset_history','usuarioLogado',appearanceKey()].includes(event.key)) {
      updateContext();
      renderAppearance();
    }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
