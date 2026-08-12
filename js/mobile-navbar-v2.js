(() => {
  'use strict';
  if (window.__RRN_MOBILE_NAVBAR_V2__) return;
  window.__RRN_MOBILE_NAVBAR_V2__ = true;

  const BREAKPOINT = 780;

  function refs() {
    return {
      navbar: document.querySelector('.navbar'),
      toggle: document.querySelector('.menu-toggle'),
      nav: document.querySelector('.navbar .nav-links')
    };
  }

  function isMobile() {
    return window.matchMedia(`(max-width:${BREAKPOINT}px)`).matches;
  }

  function setOpen(open) {
    const { toggle, nav } = refs();
    if (!toggle || !nav) return;
    nav.classList.toggle('active', Boolean(open) && isMobile());
    toggle.setAttribute('aria-expanded', String(Boolean(open) && isMobile()));
    toggle.setAttribute('aria-label', Boolean(open) && isMobile() ? 'Fechar menu' : 'Abrir menu');
    document.body.classList.toggle('rrn-mobile-nav-open', Boolean(open) && isMobile());
  }

  window.toggleMenu = function toggleMenu() {
    const { nav } = refs();
    if (!nav || !isMobile()) return;
    setOpen(!nav.classList.contains('active'));
  };

  function bind() {
    const { toggle, nav, navbar } = refs();
    if (!toggle || !nav || !navbar) return;

    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', nav.id || 'rrnMobileNav');
    if (!nav.id) nav.id = 'rrnMobileNav';

    document.addEventListener('click', event => {
      if (!isMobile() || !nav.classList.contains('active')) return;
      if (toggle.contains(event.target)) return;
      if (!navbar.contains(event.target)) return setOpen(false);

      const action = event.target.closest('a, .rrn-app-tab, .logout-btn');
      if (action) setTimeout(() => setOpen(false), 0);
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') setOpen(false);
    });

    window.addEventListener('resize', () => {
      if (!isMobile()) setOpen(false);
    });

    setOpen(false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();