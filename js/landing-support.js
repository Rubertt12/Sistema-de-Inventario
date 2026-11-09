(() => {
  'use strict';

  // O chat é aberto como página própria para evitar bloqueios de iframe
  // em navegadores móveis e WebViews que exibem "conexão recusada".
  function createSupportChat() {
    return () => {
      window.location.assign('/suporte-rapido.html');
    };
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
