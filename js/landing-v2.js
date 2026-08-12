(() => {
  'use strict';
  const year = document.getElementById('landingYear');
  if (year) year.textContent = new Date().getFullYear();

  const toggle = document.getElementById('landingMenuToggle');
  const nav = document.getElementById('landingNav');
  toggle?.addEventListener('click', () => {
    const open = nav?.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(Boolean(open)));
  });
  nav?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    nav.classList.remove('open');
    toggle?.setAttribute('aria-expanded', 'false');
  }));

  function addSupportEntryPoints() {
    if (document.querySelector('[data-rrn-support-landing]')) return;

    const navLink = document.createElement('a');
    navLink.href = '#suporte';
    navLink.textContent = 'Suporte';
    navLink.dataset.rrnSupportLanding = 'nav';
    nav?.appendChild(navLink);

    const actions = document.querySelector('.landing-nav-actions');
    if (actions) {
      const support = document.createElement('a');
      support.href = '/portal.html';
      support.className = 'landing-btn landing-btn-ghost';
      support.textContent = 'Abrir chamado';
      support.dataset.rrnSupportLanding = 'header';
      actions.insertBefore(support, actions.firstChild);
    }

    const heroActions = document.querySelector('.landing-hero-actions');
    if (heroActions) {
      const support = document.createElement('a');
      support.href = '/portal.html';
      support.className = 'landing-btn landing-btn-secondary landing-btn-lg';
      support.textContent = 'Preciso de suporte';
      support.dataset.rrnSupportLanding = 'hero';
      heroActions.appendChild(support);
    }

    const security = document.getElementById('seguranca');
    if (security) {
      const section = document.createElement('section');
      section.className = 'landing-section landing-section-soft';
      section.id = 'suporte';
      section.dataset.rrnSupportLanding = 'section';
      section.innerHTML = `<div class="landing-container landing-business-card"><div><span class="landing-eyebrow">Portal do colaborador</span><h2>Precisa de suporte?</h2><p>Abra e acompanhe solicitações em uma conversa. O RRN Manager identifica o equipamento pelo patrimônio, serial ou hostname, relaciona o setor e mantém o SLA visível do início ao fim.</p><div class="landing-hero-actions"><a class="landing-btn landing-btn-primary landing-btn-lg" href="/portal.html">Abrir chamado</a><a class="landing-btn landing-btn-secondary landing-btn-lg" href="/portal.html">Acompanhar meus chamados</a></div></div><div class="landing-url-card"><small>Fluxo de atendimento</small><code>Login → Equipamento → Problema → SLA → Chat</code><span>O chamado fica ligado ao histórico do ativo quando o equipamento é reconhecido.</span></div></div>`;
      security.parentNode.insertBefore(section, security);
    }

    const footerAccess = [...document.querySelectorAll('.landing-footer-column')].find(column => column.querySelector('strong')?.textContent?.trim() === 'Acesso');
    if (footerAccess) {
      const link = document.createElement('a');
      link.href = '/portal.html';
      link.textContent = 'Portal de suporte';
      footerAccess.appendChild(link);
    }

    navLink.addEventListener('click', () => {
      nav?.classList.remove('open');
      toggle?.setAttribute('aria-expanded', 'false');
    });
  }

  addSupportEntryPoints();
})();
