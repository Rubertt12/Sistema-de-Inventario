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

  function ensureSupportChat() {
    if (!document.querySelector('link[data-rrn-landing-support-style]')) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = '/style/landing-support-chat.css';
      css.dataset.rrnLandingSupportStyle = '1';
      document.head.appendChild(css);
    }

    if (!document.getElementById('landingSupportDrawer')) {
      document.body.insertAdjacentHTML('beforeend', `
        <div class="landing-chat-overlay" id="landingSupportOverlay"></div>
        <aside class="landing-chat-drawer" id="landingSupportDrawer" aria-label="Chat de suporte" aria-hidden="true">
          <header class="landing-chat-head"><div><strong>Suporte RRN Manager</strong><small>Entre com sua conta ou apenas se identifique</small></div><button class="landing-chat-close" id="landingSupportClose" type="button" aria-label="Fechar">×</button></header>
          <iframe class="landing-chat-frame" id="landingSupportFrame" title="Suporte rápido" loading="lazy"></iframe>
        </aside>
        <button class="landing-chat-fab" id="landingSupportFab" type="button" aria-label="Abrir suporte"><b>●</b><span>Suporte</span></button>`);
    }

    const drawer = document.getElementById('landingSupportDrawer');
    const frame = document.getElementById('landingSupportFrame');
    const open = () => {
      if (!frame.src) frame.src = '/suporte-rapido.html';
      document.body.classList.add('landing-chat-open');
      drawer.setAttribute('aria-hidden','false');
    };
    const close = () => {
      document.body.classList.remove('landing-chat-open');
      drawer.setAttribute('aria-hidden','true');
    };
    document.getElementById('landingSupportFab')?.addEventListener('click',open);
    document.getElementById('landingSupportClose')?.addEventListener('click',close);
    document.getElementById('landingSupportOverlay')?.addEventListener('click',close);
    document.addEventListener('keydown',e => { if (e.key === 'Escape') close(); });
    return open;
  }

  function addSupportEntryPoints() {
    if (document.querySelector('[data-rrn-support-landing]')) return;
    const openSupport = ensureSupportChat();

    const navLink = document.createElement('a');
    navLink.href = '#suporte';
    navLink.textContent = 'Suporte';
    navLink.dataset.rrnSupportLanding = 'nav';
    nav?.appendChild(navLink);

    const actions = document.querySelector('.landing-nav-actions');
    if (actions) {
      const support = document.createElement('button');
      support.type = 'button';
      support.className = 'landing-btn landing-btn-ghost landing-support-btn';
      support.textContent = 'Abrir suporte';
      support.dataset.rrnSupportLanding = 'header';
      support.addEventListener('click',openSupport);
      actions.insertBefore(support, actions.firstChild);
    }

    const heroActions = document.querySelector('.landing-hero-actions');
    if (heroActions) {
      const support = document.createElement('button');
      support.type = 'button';
      support.className = 'landing-btn landing-btn-secondary landing-btn-lg';
      support.textContent = 'Preciso de suporte';
      support.dataset.rrnSupportLanding = 'hero';
      support.addEventListener('click',openSupport);
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
      section.querySelector('[data-open-quick-support]')?.addEventListener('click',openSupport);
    }

    const footerAccess = [...document.querySelectorAll('.landing-footer-column')].find(column => column.querySelector('strong')?.textContent?.trim() === 'Acesso');
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