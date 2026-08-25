(() => {
  'use strict';

  function createSupportChat() {
    document.body.insertAdjacentHTML('beforeend', `
      <div class="landing-chat-overlay" id="landingSupportOverlay"></div>
      <aside class="landing-chat-drawer" id="landingSupportDrawer" aria-label="Chat de suporte" aria-hidden="true">
        <header class="landing-chat-head"><div><strong>Suporte RRN Manager</strong><small>Entre com sua conta ou apenas se identifique</small></div><button class="landing-chat-close" id="landingSupportClose" type="button" aria-label="Fechar">×</button></header>
        <iframe class="landing-chat-frame" id="landingSupportFrame" title="Suporte rápido" loading="lazy"></iframe>
      </aside>
      <button class="landing-chat-fab" id="landingSupportFab" type="button" aria-label="Abrir chat de suporte">
        <svg class="landing-chat-fab-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span>Chamar suporte</span>
      </button>`);

    const drawer = document.getElementById('landingSupportDrawer');
    const frame = document.getElementById('landingSupportFrame');
    const open = () => {
      if (!frame.src) frame.src = '/suporte-rapido.html';
      document.body.classList.add('landing-chat-open');
      drawer.setAttribute('aria-hidden', 'false');
    };
    const close = () => {
      document.body.classList.remove('landing-chat-open');
      drawer.setAttribute('aria-hidden', 'true');
    };

    document.getElementById('landingSupportFab')?.addEventListener('click', open);
    document.getElementById('landingSupportClose')?.addEventListener('click', close);
    document.getElementById('landingSupportOverlay')?.addEventListener('click', close);
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') close();
    });
    return open;
  }

  function addSupportEntryPoints() {
    if (document.querySelector('[data-rrn-support-landing]')) return;
    const openSupport = createSupportChat();
    const nav = document.getElementById('landingNav');
    const toggle = document.getElementById('landingMenuToggle');

    const navLink = document.createElement('a');
    navLink.href = '#suporte';
    navLink.textContent = 'Suporte';
    navLink.dataset.rrnSupportLanding = 'nav';
    nav?.appendChild(navLink);

    const heroActions = document.querySelector('.landing-hero-actions');
    if (heroActions) {
      const support = document.createElement('button');
      support.type = 'button';
      support.className = 'landing-btn landing-btn-secondary landing-btn-lg';
      support.textContent = 'Preciso de suporte';
      support.dataset.rrnSupportLanding = 'hero';
      support.addEventListener('click', openSupport);
      heroActions.appendChild(support);
    }

    const security = document.getElementById('seguranca');
    if (security) {
      const section = document.createElement('section');
      section.className = 'landing-section landing-section-soft';
      section.id = 'suporte';
      section.dataset.rrnSupportLanding = 'section';
      section.innerHTML = `<div class="landing-container landing-business-card"><div><span class="landing-eyebrow">Portal do colaborador</span><h2>Precisa de suporte?</h2><p>Abra e acompanhe solicitações em uma conversa. Você pode entrar com sua conta ou continuar sem login, apenas se identificando.</p><div class="landing-hero-actions"><button class="landing-btn landing-btn-primary landing-btn-lg" type="button" data-open-quick-support>Abrir suporte</button><a class="landing-btn landing-btn-secondary landing-btn-lg" href="/portal.html">Acompanhar com minha conta</a></div></div><div class="landing-url-card"><small>Fluxo de atendimento</small><code>Identificação → Equipamento → Problema → Chat</code><span>A prioridade é classificada pela equipe de suporte, não pelo colaborador.</span></div></div>`;
      security.parentNode.insertBefore(section, security);
      section.querySelector('[data-open-quick-support]')?.addEventListener('click', openSupport);
    }

    const footerAccess = [...document.querySelectorAll('.landing-footer-column')]
      .find(column => column.querySelector('strong')?.textContent?.trim() === 'Acesso');
    if (footerAccess) {
      const link = document.createElement('a');
      link.href = '/suporte-rapido.html';
      link.textContent = 'Suporte rápido';
      footerAccess.appendChild(link);
    }

    navLink.addEventListener('click', () => {
      nav?.classList.remove('open');
      toggle?.setAttribute('aria-expanded', 'false');
    });
  }

  addSupportEntryPoints();
})();
