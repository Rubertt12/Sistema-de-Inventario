(() => {
  'use strict';

  const shell = document.getElementById('authShell');
  if (!shell) return;

  function setMode(mode) {
    const register = mode === 'register';
    shell.classList.toggle('is-register', register);

    const brandTitle = document.getElementById('brandTitle');
    const brandSubtitle = document.getElementById('brandSubtitle');
    if (brandTitle) brandTitle.textContent = register
      ? 'Organize seu patrimônio desde o primeiro acesso'
      : 'Controle patrimonial com mais organização e eficiência';
    if (brandSubtitle) brandSubtitle.textContent = register
      ? 'Cadastre sua organização e comece a centralizar equipamentos, responsáveis, setores e movimentações em um só lugar.'
      : 'Gerencie equipamentos, responsáveis, setores e movimentações com praticidade e visão centralizada.';
  }

  document.addEventListener('click', event => {
    const tab = event.target.closest?.('.auth-tab');
    if (tab?.dataset.target) setMode(tab.dataset.target);

    if (event.target.closest?.('#forgotPasswordButton,[data-auth-back]')) {
      setMode('login');
    }
  });

  const requestedMode = new URLSearchParams(location.search).get('mode');
  setMode(requestedMode === 'register' ? 'register' : 'login');
})();
