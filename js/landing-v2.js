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

})();
