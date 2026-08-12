(() => {
  'use strict';
  if (window.__RRN_SETTINGS_V2__) return;
  window.__RRN_SETTINGS_V2__ = true;

  const el = (tag, className, html = '') => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (html) node.innerHTML = html;
    return node;
  };

  function makeCard(icon, title, description) {
    const card = el('section', 'rrn-settings-card');
    card.innerHTML = `<header class="rrn-settings-card-head"><span class="rrn-settings-card-icon" data-rrn-icon="${icon}"></span><div><h3>${title}</h3><p>${description}</p></div></header>`;
    const body = el('div', 'rrn-settings-card-body');
    card.appendChild(body);
    return { card, body };
  }

  function makeAction(label, description, action, tone = '') {
    const button = el('button', `rrn-settings-action ${tone}`.trim());
    button.type = 'button';
    button.innerHTML = `<span><strong>${label}</strong><small>${description}</small></span><span class="rrn-settings-action-arrow" aria-hidden="true">›</span>`;
    button.addEventListener('click', action);
    return button;
  }

  function buildThemeControl() {
    const wrap = el('div', 'rrn-settings-theme');
    wrap.innerHTML = '<span class="rrn-field-label">Tema do sistema</span><div class="rrn-theme-segment" role="group" aria-label="Tema do sistema"><button type="button" data-theme-choice="light">Claro</button><button type="button" data-theme-choice="dark">Escuro</button></div>';
    const sync = () => {
      const mode = document.documentElement.dataset.theme || 'light';
      wrap.querySelectorAll('[data-theme-choice]').forEach(button => button.classList.toggle('active', button.dataset.themeChoice === mode));
    };
    wrap.querySelectorAll('[data-theme-choice]').forEach(button => button.addEventListener('click', () => {
      window.RRN_THEME?.set?.(button.dataset.themeChoice);
      sync();
    }));
    window.addEventListener('rrn:themechange', sync);
    sync();
    return wrap;
  }

  function groupLegacyData(right, dataBody) {
    const headings = Array.from(right.querySelectorAll(':scope > h3'));
    const grid = el('div', 'rrn-settings-data-grid');
    headings.forEach(heading => {
      const group = el('div', 'rrn-settings-data-group');
      const title = el('div', 'rrn-settings-data-title');
      title.textContent = heading.textContent.replace(/DADOS\s*/i, '').trim() || heading.textContent.trim();
      group.appendChild(title);
      let sibling = heading.nextElementSibling;
      heading.remove();
      while (sibling && sibling.tagName !== 'H3' && !sibling.classList.contains('box-bg-selector')) {
        const next = sibling.nextElementSibling;
        group.appendChild(sibling);
        sibling = next;
      }
      grid.appendChild(group);
    });
    dataBody.appendChild(grid);
  }

  function enhanceAppearance(box, body) {
    if (!box) return;
    box.classList.add('rrn-settings-appearance');
    const oldTitle = box.querySelector(':scope > h3');
    if (oldTitle) oldTitle.remove();
    body.appendChild(buildThemeControl());
    body.appendChild(box);

    const reset = el('button', 'rrn-settings-reset');
    reset.type = 'button';
    reset.textContent = 'Restaurar fundo padrão';
    reset.addEventListener('click', () => {
      try {
        const session = window.RRN_SESSION || {};
        let local = {};
        try { local = JSON.parse(localStorage.getItem('usuarioLogado') || '{}'); } catch {}
        const tenant = session.tenantId || local.tenant_id || 'local';
        localStorage.removeItem(`dashboardBgConfig_${tenant}`);
        document.body.style.backgroundImage = 'none';
        document.body.style.backgroundColor = '';
        const url = document.getElementById('bgImageUrl');
        const upload = document.getElementById('bgImageUpload');
        if (url) url.value = '';
        if (upload) upload.value = '';
        window.RRN_UI?.applyAppearance?.({ layout: document.getElementById('layoutToggle')?.checked ? 'list' : 'grid' });
      } catch (error) {
        console.warn('Não foi possível restaurar o fundo.', error);
      }
    });
    body.appendChild(reset);
  }

  function securityCard() {
    const { card, body } = makeCard('lock', 'Acesso e segurança', 'Atalhos para sua conta e administração do ambiente.');
    body.classList.add('rrn-settings-action-list');
    body.appendChild(makeAction('Alterar senha', 'Atualize sua credencial de acesso.', () => {
      if (window.openPasswordChangeModal) window.openPasswordChangeModal();
      else alert('O gerenciador de senha ainda está carregando. Tente novamente em alguns segundos.');
    }));

    let role = window.RRN_SESSION?.role;
    if (!role) {
      try { role = JSON.parse(localStorage.getItem('usuarioLogado') || '{}').perfil; } catch {}
    }
    if (role === 'admin' || role == null) {
      body.appendChild(makeAction('Gestão de usuários', 'Usuários, empresas, convites e identidade visual.', () => {
        if (typeof window.abrirPaginaUsuarios === 'function') window.abrirPaginaUsuarios();
        else location.href = 'usuarios.html';
      }));
    }
    return card;
  }

  function build() {
    const modal = document.getElementById('configModal');
    if (!modal || modal.dataset.rrnSettingsV2 === '1') return;
    modal.dataset.rrnSettingsV2 = '1';
    modal.classList.add('rrn-settings-v2');

    const left = modal.querySelector('.modal-left');
    const right = modal.querySelector('.modal-right');
    const save = modal.querySelector('.save-btn');
    if (!left || !right) return;

    const intro = el('div', 'rrn-settings-v2-intro', '<div><span>Preferências do ambiente</span><strong>Central de configurações</strong><p>Organize aparência, conta, segurança e movimentação de dados em um único painel.</p></div>');
    const title = modal.querySelector('.modal-title');
    const subtitle = modal.querySelector('.rrn-settings-subtitle');
    title?.insertAdjacentElement('afterend', intro);
    subtitle?.remove();

    const grid = el('div', 'rrn-settings-v2-grid');

    const account = makeCard('user', 'Perfil e ambiente', 'Sua identificação e o contexto atual do inventário.');
    while (left.firstChild) account.body.appendChild(left.firstChild);
    grid.appendChild(account.card);

    const appearance = makeCard('settings', 'Aparência e visualização', 'Tema, layout e fundo utilizados no inventário.');
    const appearanceBox = right.querySelector('.box-bg-selector');
    enhanceAppearance(appearanceBox, appearance.body);
    grid.appendChild(appearance.card);

    const data = makeCard('database', 'Dados e portabilidade', 'Backup e intercâmbio de informações do inventário.');
    groupLegacyData(right, data.body);
    grid.appendChild(data.card);

    grid.appendChild(securityCard());
    intro.insertAdjacentElement('afterend', grid);

    left.hidden = true;
    right.hidden = true;

    if (save) {
      const footer = el('footer', 'rrn-settings-v2-footer');
      const note = el('span', 'rrn-settings-v2-note');
      note.textContent = 'As preferências visuais são aplicadas imediatamente.';
      footer.append(note, save);
      modal.appendChild(footer);
      save.textContent = 'Concluir';
    }

    window.RRN_ICONS?.decorateStatic?.();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build, { once: true });
  else build();
  window.addEventListener('load', build, { once: true });
})();