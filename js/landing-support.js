(() => {
  'use strict';

  let loading = null;
  let mounted = false;

  const addStylesheet = href => {
    if ([...document.querySelectorAll('link[rel="stylesheet"]')].some(link => link.href.includes(href))) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  };

  function createWidget() {
    if (document.getElementById('rrnLandingSupport')) return;
    const widget = document.createElement('div');
    widget.id = 'rrnLandingSupport';
    widget.innerHTML = `
      <div class="landing-chat-overlay" data-support-close></div>
      <section class="landing-chat-drawer" role="dialog" aria-modal="true" aria-label="Chat de suporte" aria-hidden="true">
        <header class="landing-chat-head">
          <div><strong>Suporte RRN Manager</strong><small>Atendimento direto pela página inicial</small></div>
          <button class="landing-chat-close" type="button" aria-label="Fechar chat" data-support-close>×</button>
        </header>
        <div class="landing-chat-content" id="rrnLandingSupportContent">
          <div class="landing-chat-loading"><span class="landing-chat-spinner"></span><strong>Preparando atendimento...</strong><small>Isso leva só alguns segundos.</small></div>
        </div>
      </section>
      <button class="landing-chat-fab" type="button" aria-label="Abrir chat de suporte" aria-expanded="false">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-6.5A7.5 7.5 0 1 1 20 11.5Z"/><path d="M8 11h8M8 14h5"/></svg><span>Falar com suporte</span>
      </button>`;
    document.body.appendChild(widget);

    const fab = widget.querySelector('.landing-chat-fab');
    const drawer = widget.querySelector('.landing-chat-drawer');
    const close = () => {
      document.body.classList.remove('landing-chat-open');
      fab.setAttribute('aria-expanded','false');
      drawer.setAttribute('aria-hidden','true');
    };
    const open = async () => {
      document.body.classList.add('landing-chat-open');
      fab.setAttribute('aria-expanded','true');
      drawer.setAttribute('aria-hidden','false');
      await mountSupport();
    };
    fab.addEventListener('click',open);
    widget.querySelectorAll('[data-support-close]').forEach(el => el.addEventListener('click',close));
    document.addEventListener('keydown',event => { if (event.key === 'Escape') close(); });
    window.RRNLandingSupportOpen = open;
  }

  function loadScript(src) {
    return new Promise((resolve,reject) => {
      const existing = [...document.scripts].find(script => script.src && script.src.includes(src));
      if (existing?.dataset.loaded === 'true') return resolve();
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = () => { script.dataset.loaded = 'true'; resolve(); };
      script.onerror = () => reject(new Error('Não foi possível carregar ' + src));
      document.body.appendChild(script);
    });
  }

  async function mountSupport() {
    if (mounted) return;
    if (loading) return loading;
    loading = (async () => {
      const content = document.getElementById('rrnLandingSupportContent');
      try {
        addStylesheet('/style/support-quick.css?v=20261109-4');
        addStylesheet('/style/support-quick-controls.css?v=20261109-4');
        addStylesheet('/style/support-bot-runtime.css?v=20261109-4');
        const response = await fetch('/suporte-rapido.html', { credentials:'same-origin' });
        if (!response.ok) throw new Error('Não foi possível abrir o atendimento (' + response.status + ').');
        const html = await response.text();
        const parsed = new DOMParser().parseFromString(html,'text/html');
        const shell = parsed.querySelector('.quick-shell');
        if (!shell) throw new Error('A estrutura do atendimento não foi encontrada.');
        content.innerHTML = '';
        content.appendChild(document.importNode(shell,true));
        await loadScript('/js/supabase-config.js');
        await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
        await loadScript('/js/support-quick.js?v=20261109-4');
        mounted = true;
      } catch (error) {
        console.error('RRN landing support:',error);
        content.innerHTML = '<div class="landing-chat-error"><strong>Não foi possível carregar o chat.</strong><p>' + String(error.message || 'Tente novamente em instantes.') + '</p><a href="/suporte-rapido.html">Abrir suporte em página separada</a></div>';
        loading = null;
      }
    })();
    return loading;
  }

  function addSupportEntryPoints() {
    createWidget();
    const nav = document.getElementById('landingNav');
    const toggle = document.getElementById('landingMenuToggle');
    if (nav && !nav.querySelector('[data-rrn-support-nav]')) {
      const navLink = document.createElement('a');
      navLink.href = '#suporte';
      navLink.textContent = 'Suporte';
      navLink.dataset.rrnSupportNav = 'true';
      nav.appendChild(navLink);
      navLink.addEventListener('click',() => {
        nav.classList.remove('open');
        toggle?.setAttribute('aria-expanded','false');
      });
    }

    document.querySelectorAll('.landing-hero-actions button[data-rrn-support-landing], [data-open-quick-support]').forEach(button => {
      button.addEventListener('click',() => window.RRNLandingSupportOpen?.());
    });

    const heroActions = document.querySelector('.landing-hero-actions');
    if (heroActions && !heroActions.querySelector('[data-rrn-support-landing="hero"]')) {
      const support = document.createElement('button');
      support.type = 'button';
      support.className = 'landing-btn landing-btn-secondary landing-btn-lg';
      support.textContent = 'Preciso de suporte';
      support.dataset.rrnSupportLanding = 'hero';
      support.addEventListener('click',() => window.RRNLandingSupportOpen?.());
      heroActions.appendChild(support);
    }

    const security = document.getElementById('seguranca');
    if (security && !document.getElementById('suporte')) {
      const section = document.createElement('section');
      section.className = 'landing-section landing-section-soft';
      section.id = 'suporte';
      section.innerHTML = `<div class="landing-container landing-business-card"><div><span class="landing-eyebrow">Portal do colaborador</span><h2>Precisa de suporte?</h2><p>Inicie uma conversa sem sair da página. Você pode entrar com sua conta ou continuar apenas se identificando.</p><div class="landing-hero-actions"><button class="landing-btn landing-btn-primary landing-btn-lg" type="button" data-open-quick-support>Abrir chat de suporte</button><a class="landing-btn landing-btn-secondary landing-btn-lg" href="/portal.html">Acompanhar com minha conta</a></div></div><div class="landing-url-card"><small>Fluxo de atendimento</small><code>Identificação → Equipamento → Problema → Chat</code><span>O atendimento acontece nesta própria página.</span></div></div>`;
      security.parentNode.insertBefore(section,security);
      section.querySelector('[data-open-quick-support]')?.addEventListener('click',() => window.RRNLandingSupportOpen?.());
    }

    const footerAccess = [...document.querySelectorAll('.landing-footer-column')].find(column => column.querySelector('strong')?.textContent?.trim() === 'Acesso');
    if (footerAccess && ![...footerAccess.querySelectorAll('a')].some(a => a.textContent.trim() === 'Suporte rápido')) {
      const link = document.createElement('a');
      link.href = '/suporte-rapido.html';
      link.textContent = 'Suporte rápido';
      footerAccess.appendChild(link);
    }
  }

  addSupportEntryPoints();
})();