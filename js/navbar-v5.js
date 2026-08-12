(() => {
  'use strict';
  if (window.__RRN_NAVBAR_V5__) return;
  window.__RRN_NAVBAR_V5__ = true;

  const BREAKPOINT = 780;
  let observer = null;
  let scheduled = false;

  function ensureStylesheet(href, marker) {
    if (document.querySelector(`link[${marker}]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute(marker, '1');
    document.head.appendChild(link);
  }

  function ensureCss() {
    ensureStylesheet('/style/navbar-v5.css', 'data-rrn-navbar-v5');
    ensureStylesheet('/style/navbar-flat-tabs.css', 'data-rrn-navbar-flat-tabs');
  }

  function sessionInfo() {
    let compat = {};
    try { compat = JSON.parse(localStorage.getItem('usuarioLogado') || '{}'); } catch {}
    return {
      tenant: window.RRN_SESSION?.tenantName || window.RRN_SESSION?.tenant || compat.tenant_name || compat.tenant || '',
      role: window.RRN_SESSION?.role || compat.perfil || ''
    };
  }

  function roleLabel(role) {
    return ({ admin:'Administrador', operador:'Operador', monitoramento:'Monitoramento' })[role] || '';
  }

  function isMobile() {
    return window.matchMedia(`(max-width:${BREAKPOINT}px)`).matches;
  }

  function refs() {
    return {
      navbar: document.querySelector('.navbar'),
      brand: document.querySelector('.navbar > h1'),
      toggle: document.querySelector('.navbar .menu-toggle'),
      nav: document.querySelector('.navbar .nav-links'),
      search: document.getElementById('searchInput'),
      user: document.querySelector('.navbar .user-menu')
    };
  }

  function enhanceBrand() {
    const { brand } = refs();
    if (!brand) return;
    if (brand.dataset.rrnNavbarV5 === '1') {
      updateBrandMeta();
      return;
    }

    const icon = brand.querySelector('.navbar-icon');
    const src = icon?.getAttribute('src') || './img/icon-png.png';
    brand.dataset.rrnNavbarV5 = '1';
    brand.innerHTML = `
      <span class="rrn-navbar-brand-mark"><img src="${src}" alt="" class="navbar-icon"></span>
      <span class="rrn-navbar-brand-copy"><strong>RRN Manager</strong><small data-rrn-navbar-meta>Gestão de ativos</small></span>`;
    brand.title = 'RRN Manager · Gestão de ativos e suporte';
    updateBrandMeta();
  }

  function updateBrandMeta() {
    const meta = document.querySelector('[data-rrn-navbar-meta]');
    if (!meta) return;
    const info = sessionInfo();
    const parts = [info.tenant, roleLabel(info.role)].filter(Boolean);
    meta.textContent = parts.join(' · ') || 'Gestão de ativos';
  }

  function enhanceSearch() {
    const { search } = refs();
    if (!search || search.dataset.rrnNavbarV5 === '1') return;
    search.dataset.rrnNavbarV5 = '1';
    search.placeholder = 'Buscar patrimônio, serial, usuário...';
    search.setAttribute('aria-label', 'Buscar patrimônio, serial, usuário ou equipamento');

    const wrapper = document.createElement('div');
    wrapper.className = 'rrn-navbar-search';
    search.parentNode.insertBefore(wrapper, search);
    wrapper.appendChild(search);

    const hint = document.createElement('kbd');
    hint.textContent = /Mac|iPhone|iPad/.test(navigator.platform || '') ? '⌘ K' : 'Ctrl K';
    wrapper.appendChild(hint);
  }

  function enhanceToggle() {
    const { toggle, nav } = refs();
    if (!toggle || !nav) return;
    if (!nav.id) nav.id = 'rrnMobileNav';
    toggle.setAttribute('aria-controls', nav.id);
    toggle.setAttribute('aria-expanded', String(nav.classList.contains('active') && isMobile()));
    toggle.setAttribute('aria-label', nav.classList.contains('active') && isMobile() ? 'Fechar menu' : 'Abrir menu');
    if (toggle.dataset.rrnNavbarV5 !== '1') {
      toggle.dataset.rrnNavbarV5 = '1';
      toggle.innerHTML = '<span class="rrn-menu-bars" aria-hidden="true"><span></span><span></span><span></span></span>';
    }
  }

  function enhanceUser() {
    const { user } = refs();
    if (!user) return;
    if (!user.querySelector('.rrn-navbar-chevron')) {
      const chevron = document.createElement('span');
      chevron.className = 'rrn-navbar-chevron';
      chevron.setAttribute('aria-hidden', 'true');
      chevron.textContent = '⌄';
      const dropdown = user.querySelector('.user-dropdown');
      user.insertBefore(chevron, dropdown || null);
    }
  }

  function enhanceTabs() {
    document.querySelectorAll('.navbar .rrn-app-tab').forEach(tab => {
      if (tab.dataset.rrnNavbarV5 === '1') return;
      tab.dataset.rrnNavbarV5 = '1';
      const label = tab.textContent.trim();
      if (label && !tab.title) tab.title = label;
    });
  }

  function setOpen(open) {
    const { nav, toggle } = refs();
    if (!nav || !toggle) return;
    const next = Boolean(open) && isMobile();
    nav.classList.toggle('active', next);
    toggle.setAttribute('aria-expanded', String(next));
    toggle.setAttribute('aria-label', next ? 'Fechar menu' : 'Abrir menu');
    document.body.classList.toggle('rrn-mobile-nav-open', next);
  }

  window.toggleMenu = function toggleMenu() {
    const { nav } = refs();
    if (!nav || !isMobile()) return;
    setOpen(!nav.classList.contains('active'));
  };

  function bindOnce() {
    if (document.documentElement.dataset.rrnNavbarV5Bound === '1') return;
    document.documentElement.dataset.rrnNavbarV5Bound = '1';

    document.addEventListener('click', event => {
      const { navbar, toggle, nav } = refs();
      if (!navbar || !nav || !isMobile() || !nav.classList.contains('active')) return;
      if (toggle?.contains(event.target)) return;
      if (!navbar.contains(event.target)) return setOpen(false);
      if (event.target.closest('a,.rrn-app-tab,.logout-btn')) setTimeout(() => setOpen(false), 0);
    });

    document.addEventListener('keydown', event => {
      const shortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
      if (shortcut) {
        const search = document.getElementById('searchInput');
        if (!search) return;
        event.preventDefault();
        if (isMobile()) setOpen(true);
        setTimeout(() => { search.focus(); search.select?.(); }, 30);
        return;
      }
      if (event.key === 'Escape') setOpen(false);
    });

    window.addEventListener('resize', () => { if (!isMobile()) setOpen(false); });
    window.addEventListener('rrn:session-ready', () => setTimeout(updateBrandMeta, 0));
    window.addEventListener('rrn:tenantbranding', () => setTimeout(updateBrandMeta, 0));
  }

  function enhance() {
    ensureCss();
    enhanceBrand();
    enhanceSearch();
    enhanceToggle();
    enhanceUser();
    enhanceTabs();
    bindOnce();
  }

  function scheduleEnhance() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      enhance();
    });
  }

  function boot() {
    enhance();
    const navbar = document.querySelector('.navbar');
    if (navbar && !observer) {
      observer = new MutationObserver(scheduleEnhance);
      observer.observe(navbar, { childList:true, subtree:true });
    }
    setTimeout(enhance, 160);
    setTimeout(enhance, 700);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
