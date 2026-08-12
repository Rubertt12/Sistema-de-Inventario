(() => {
  'use strict';
  if (window.__RRN_SETTINGS_V3__) return;
  window.__RRN_SETTINGS_V3__ = true;

  const q = (selector, root = document) => root.querySelector(selector);
  const qa = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const make = (tag, className, html = '') => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (html) node.innerHTML = html;
    return node;
  };

  function currentRole() {
    if (window.RRN_SESSION?.role) return window.RRN_SESSION.role;
    try { return JSON.parse(localStorage.getItem('usuarioLogado') || '{}').perfil || null; }
    catch { return null; }
  }

  function currentWorkspace() {
    let local = {};
    try { local = JSON.parse(localStorage.getItem('usuarioLogado') || '{}'); } catch {}
    return {
      name: window.RRN_SESSION?.tenantName || local.tenant || 'Workspace atual',
      role: window.RRN_SESSION?.role || local.perfil || 'Usuário'
    };
  }

  function card(title, description, className = '') {
    const section = make('section', `rrn-pref-card ${className}`.trim());
    section.innerHTML = `<div class="rrn-pref-card-head"><div><h3>${title}</h3><p>${description}</p></div></div>`;
    const body = make('div', 'rrn-pref-card-body');
    section.appendChild(body);
    return { section, body };
  }

  function action(label, description, handler, tone = '') {
    const button = make('button', `rrn-pref-action ${tone}`.trim());
    button.type = 'button';
    button.innerHTML = `<span class="rrn-pref-action-copy"><strong>${label}</strong><small>${description}</small></span><span class="rrn-pref-chevron" aria-hidden="true">›</span>`;
    button.addEventListener('click', handler);
    return button;
  }

  function buildThemeSelector() {
    const wrap = make('div', 'rrn-pref-control');
    wrap.innerHTML = `<div><strong>Tema do sistema</strong><small>Escolha a aparência mais confortável para você.</small></div><div class="rrn-pref-segment" role="group" aria-label="Tema do sistema"><button type="button" data-theme-choice="light">Claro</button><button type="button" data-theme-choice="dark">Escuro</button></div>`;
    const sync = () => {
      const mode = document.documentElement.dataset.theme || 'light';
      qa('[data-theme-choice]', wrap).forEach(btn => btn.classList.toggle('active', btn.dataset.themeChoice === mode));
    };
    qa('[data-theme-choice]', wrap).forEach(btn => btn.addEventListener('click', () => {
      window.RRN_THEME?.set?.(btn.dataset.themeChoice);
      sync();
    }));
    window.addEventListener('rrn:themechange', sync);
    sync();
    return wrap;
  }

  function resetDashboardBackground() {
    const session = window.RRN_SESSION || {};
    let local = {};
    try { local = JSON.parse(localStorage.getItem('usuarioLogado') || '{}'); } catch {}
    const tenant = session.tenantId || local.tenant_id || 'local';
    localStorage.removeItem(`dashboardBgConfig_${tenant}`);
    document.body.style.backgroundImage = 'none';
    document.body.style.backgroundColor = '';
    const url = q('#bgImageUrl');
    const upload = q('#bgImageUpload');
    if (url) url.value = '';
    if (upload) upload.value = '';
    window.RRN_UI?.applyAppearance?.({ layout: q('#layoutToggle')?.checked ? 'list' : 'grid' });
  }

  function simplifyAppearanceBox(box) {
    if (!box) return null;
    box.classList.add('rrn-pref-appearance-box');
    q(':scope > h3', box)?.remove();

    const layout = q('.box-switch', box);
    if (layout) {
      layout.classList.add('rrn-pref-layout-row');
      const heading = q('h3', layout);
      if (heading) {
        heading.textContent = 'Visualização do inventário';
        const helper = make('small', 'rrn-pref-inline-help');
        helper.textContent = 'Alterne entre grade e lista.';
        heading.insertAdjacentElement('afterend', helper);
      }
    }

    const controls = Array.from(box.children).find(child => child !== layout);
    if (controls) controls.classList.add('rrn-pref-background-controls');
    const url = q('#bgImageUrl', box);
    if (url) url.placeholder = 'URL de uma imagem de fundo';
    const uploadLabel = q('label[for="bgImageUpload"]', box);
    if (uploadLabel) uploadLabel.textContent = 'Selecionar imagem';
    const applyUrl = q('#applyBgImageUrlBtn', box);
    if (applyUrl) applyUrl.textContent = 'Aplicar URL';
    const applyUpload = q('#applyBgUploadBtn', box);
    if (applyUpload) applyUpload.textContent = 'Aplicar imagem';
    return box;
  }

  function collectDataGroups(right) {
    const wrapper = make('div', 'rrn-pref-data-list');
    const headings = qa(':scope > h3', right);
    headings.forEach(heading => {
      const group = make('div', 'rrn-pref-data-group');
      const raw = heading.textContent.trim();
      const title = /JSON/i.test(raw) ? 'Backup completo' : /CSV/i.test(raw) ? 'Planilhas CSV' : raw;
      const description = /JSON/i.test(raw)
        ? 'Exporte ou restaure uma cópia completa do inventário.'
        : /CSV/i.test(raw)
          ? 'Importe e exporte dados para trabalhar em planilhas.'
          : 'Gerencie os dados desta seção.';
      group.innerHTML = `<div class="rrn-pref-data-copy"><strong>${title}</strong><small>${description}</small></div>`;
      const actions = make('div', 'rrn-pref-data-actions');
      let sibling = heading.nextElementSibling;
      heading.remove();
      while (sibling && sibling.tagName !== 'H3' && !sibling.classList.contains('box-bg-selector')) {
        const next = sibling.nextElementSibling;
        actions.appendChild(sibling);
        sibling = next;
      }
      group.appendChild(actions);
      wrapper.appendChild(group);
    });
    return wrapper;
  }

  function buildGeneralPanel(left) {
    const panel = make('section', 'rrn-pref-panel active');
    panel.dataset.prefPanel = 'general';
    panel.innerHTML = `<div class="rrn-pref-page-head"><span>Geral</span><h2>Seu ambiente</h2><p>Informações da conta e do workspace em uso.</p></div>`;

    const profile = card('Perfil', 'Sua foto e identificação visual dentro do sistema.', 'rrn-pref-profile-card');
    const profileSection = q('.profile-picture-section', left);
    const upload = q('.upload-btn', left);
    if (profileSection) profile.body.appendChild(profileSection);
    if (upload) profile.body.appendChild(upload);

    const workspace = card('Workspace atual', 'Confira onde você está trabalhando antes de alterar dados.', 'rrn-pref-workspace-card');
    const existingWorkspace = q('.rrn-workspace-card', left);
    if (existingWorkspace) workspace.body.appendChild(existingWorkspace);
    else {
      const ctx = currentWorkspace();
      workspace.body.innerHTML = `<div class="rrn-pref-workspace-summary"><span>Empresa</span><strong>${ctx.name}</strong><small>${ctx.role}</small></div>`;
    }

    const grid = make('div', 'rrn-pref-two-col');
    grid.append(profile.section, workspace.section);
    panel.appendChild(grid);
    return panel;
  }

  function buildAppearancePanel(right) {
    const panel = make('section', 'rrn-pref-panel');
    panel.dataset.prefPanel = 'appearance';
    panel.innerHTML = `<div class="rrn-pref-page-head"><span>Aparência</span><h2>Visual e experiência</h2><p>Ajuste tema, visualização e fundo do inventário.</p></div>`;

    const theme = card('Tema', 'Ajuste o contraste geral do RRN Manager.');
    theme.body.appendChild(buildThemeSelector());

    const layout = card('Inventário', 'Escolha como os setores aparecem e personalize o plano de fundo.');
    const appearanceBox = simplifyAppearanceBox(q('.box-bg-selector', right));
    if (appearanceBox) layout.body.appendChild(appearanceBox);
    const reset = make('button', 'rrn-pref-reset');
    reset.type = 'button';
    reset.textContent = 'Restaurar aparência padrão';
    reset.addEventListener('click', resetDashboardBackground);
    layout.body.appendChild(reset);

    panel.append(theme.section, layout.section);
    return panel;
  }

  function buildDataPanel(right) {
    const panel = make('section', 'rrn-pref-panel');
    panel.dataset.prefPanel = 'data';
    panel.innerHTML = `<div class="rrn-pref-page-head"><span>Dados</span><h2>Backup e portabilidade</h2><p>Importe, exporte e preserve os dados do inventário.</p></div>`;
    const dataCard = card('Gerenciamento de dados', 'As ações abaixo utilizam os formatos já suportados pelo sistema.');
    dataCard.body.appendChild(collectDataGroups(right));
    panel.appendChild(dataCard.section);
    return panel;
  }

  function buildSecurityPanel() {
    const panel = make('section', 'rrn-pref-panel');
    panel.dataset.prefPanel = 'security';
    panel.innerHTML = `<div class="rrn-pref-page-head"><span>Segurança</span><h2>Conta e acesso</h2><p>Gerencie sua senha e os controles administrativos disponíveis.</p></div>`;
    const security = card('Sua conta', 'Ações relacionadas ao acesso ao sistema.');
    security.body.classList.add('rrn-pref-action-list');
    security.body.appendChild(action('Alterar senha', 'Defina uma nova senha para sua conta.', () => {
      if (window.openPasswordChangeModal) window.openPasswordChangeModal();
      else alert('O gerenciador de senha ainda está carregando. Tente novamente em alguns segundos.');
    }));
    panel.appendChild(security.section);
    return panel;
  }

  function buildAdminPanel() {
    const panel = make('section', 'rrn-pref-panel');
    panel.dataset.prefPanel = 'admin';
    panel.innerHTML = `<div class="rrn-pref-page-head"><span>Administração</span><h2>Gerenciamento do workspace</h2><p>Acesse usuários, empresas, convites e identidade visual.</p></div>`;
    const admin = card('Central administrativa', 'Ferramentas avançadas ficam em uma área separada para manter as configurações simples.');
    admin.body.classList.add('rrn-pref-action-list');
    admin.body.appendChild(action('Gestão de usuários e empresas', 'Administre membros, organizações, convites e permissões.', () => {
      if (typeof window.abrirPaginaUsuarios === 'function') window.abrirPaginaUsuarios();
      else location.href = 'usuarios.html';
    }));
    admin.body.appendChild(action('Identidade visual das empresas', 'Personalize logo, cores e tela de login por empresa.', () => {
      location.href = 'usuarios.html#branding';
    }));
    panel.appendChild(admin.section);
    return panel;
  }

  const sectionMeta = [
    ['general', 'user', 'Geral', 'Perfil e workspace'],
    ['appearance', 'settings', 'Aparência', 'Tema e visualização'],
    ['data', 'database', 'Dados', 'Backup e importação'],
    ['security', 'lock', 'Segurança', 'Senha e acesso']
  ];

  function setPanel(modal, name) {
    qa('[data-pref-panel]', modal).forEach(panel => panel.classList.toggle('active', panel.dataset.prefPanel === name));
    qa('[data-pref-nav]', modal).forEach(button => {
      const active = button.dataset.prefNav === name;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
    modal.dataset.activeSettings = name;
  }

  function build() {
    const modal = q('#configModal');
    if (!modal || modal.dataset.rrnSettingsV3 === '1') return;
    modal.dataset.rrnSettingsV3 = '1';
    modal.classList.add('rrn-settings-v3');
    modal.classList.remove('rrn-settings-v2');

    const left = q('.modal-left', modal);
    const right = q('.modal-right', modal);
    const save = q('.save-btn', modal);
    if (!left || !right) return;

    q('.rrn-settings-v2-intro', modal)?.remove();
    q('.rrn-settings-v2-grid', modal)?.remove();
    q('.rrn-settings-v2-footer', modal)?.remove();
    q('.rrn-settings-subtitle', modal)?.remove();

    const title = q('.modal-title', modal);
    if (title) title.textContent = 'Configurações';

    const header = make('header', 'rrn-pref-header');
    header.innerHTML = `<div><span>RRN Manager</span><h2>Configurações</h2><p>Personalize seu ambiente e gerencie sua conta sem misturar as opções.</p></div>`;

    const shell = make('div', 'rrn-pref-shell');
    const nav = make('nav', 'rrn-pref-nav');
    nav.setAttribute('aria-label', 'Seções das configurações');
    const content = make('div', 'rrn-pref-content');

    const sections = [...sectionMeta];
    if (currentRole() === 'admin') sections.push(['admin', 'users', 'Administração', 'Usuários e empresas']);

    sections.forEach(([id, icon, label, helper]) => {
      const button = make('button', 'rrn-pref-nav-item');
      button.type = 'button';
      button.dataset.prefNav = id;
      button.setAttribute('role', 'tab');
      button.innerHTML = `<span class="rrn-pref-nav-icon" data-rrn-icon="${icon}"></span><span><strong>${label}</strong><small>${helper}</small></span>`;
      button.addEventListener('click', () => setPanel(modal, id));
      nav.appendChild(button);
    });

    content.appendChild(buildGeneralPanel(left));
    content.appendChild(buildAppearancePanel(right));
    content.appendChild(buildDataPanel(right));
    content.appendChild(buildSecurityPanel());
    if (currentRole() === 'admin') content.appendChild(buildAdminPanel());

    shell.append(nav, content);
    if (title) title.insertAdjacentElement('afterend', header);
    else modal.prepend(header);
    header.insertAdjacentElement('afterend', shell);

    left.hidden = true;
    right.hidden = true;

    const footer = make('footer', 'rrn-pref-footer');
    footer.innerHTML = '<span>As preferências visuais são aplicadas imediatamente.</span>';
    if (save) {
      save.textContent = 'Fechar configurações';
      footer.appendChild(save);
    }
    modal.appendChild(footer);

    setPanel(modal, 'general');
    window.RRN_ICONS?.decorateStatic?.();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build, { once: true });
  else build();
  window.addEventListener('load', build, { once: true });
})();