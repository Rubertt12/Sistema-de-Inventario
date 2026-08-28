// Utilitários globais mínimos do dashboard.
// Autenticação, tenant, backup, relatórios e renderização avançada vivem nos módulos v2.
(() => {
  'use strict';

  window.RRN_LEGACY_SHELL_V2 = true;

  window.toggleMenu = function toggleMenu() {
    document.querySelector('.nav-links')?.classList.toggle('active');
  };

  window.toggleUserMenu = function toggleUserMenu(event) {
    if (event) event.stopPropagation();
    const dropdown = document.getElementById('userDropdown');
    if (!dropdown) return;
    const aberto = !dropdown.hidden && dropdown.style.display !== 'none';
    dropdown.hidden = aberto;
    dropdown.style.display = aberto ? 'none' : 'block';
  };

  document.addEventListener('click', event => {
    const menu = document.querySelector('.user-menu');
    const dropdown = document.getElementById('userDropdown');
    if (!menu || !dropdown || menu.contains(event.target)) return;
    dropdown.hidden = true;
    dropdown.style.display = 'none';
  });

  window.openConfigModal = function openConfigModal() {
    const modal = document.getElementById('configModal');
    if (!modal) return;
    modal.removeAttribute('hidden');
    modal.style.display = 'flex';
    const dropdown = document.getElementById('userDropdown');
    if (dropdown) {
      dropdown.hidden = true;
      dropdown.style.display = 'none';
    }
  };

  window.closeConfigModal = function closeConfigModal() {
    const modal = document.getElementById('configModal');
    if (!modal) return;
    modal.style.display = 'none';
  };

  window.addEventListener('click', event => {
    const modal = document.getElementById('configModal');
    if (event.target === modal) window.closeConfigModal();
  });

  // Fallback leve até profile-picture-v2 substituir esta função.
  window.changeProfilePicture = function changeProfilePicture(event) {
    const file = event?.target?.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return alert('Selecione uma imagem válida.');
    if (file.size > 2 * 1024 * 1024) return alert('A imagem deve ter no máximo 2 MB.');

    const reader = new FileReader();
    reader.onload = e => {
      const value = e.target?.result;
      if (!value) return;
      const profile = document.getElementById('profilePic');
      const avatar = document.getElementById('userAvatar');
      if (profile) profile.src = value;
      if (avatar) avatar.src = value;
      localStorage.setItem('userProfileImage', value);
    };
    reader.readAsDataURL(file);
  };

  function restoreLegacyProfileImage() {
    const savedImage = localStorage.getItem('userProfileImage');
    if (!savedImage) return;
    const profile = document.getElementById('profilePic');
    const avatar = document.getElementById('userAvatar');
    if (profile) profile.src = savedImage;
    if (avatar) avatar.src = savedImage;
  }

  window.toggleChecklist = function toggleChecklist(legendElement) {
    legendElement?.parentElement?.classList.toggle('collapsed');
  };

  window.abrirPaginaUsuarios = function abrirPaginaUsuarios() {
    location.href = 'usuarios.html';
  };

  window.salvarConfigBackground = function salvarConfigBackground({ cor = null, imagem = null } = {}) {
    const tenant = window.RRN_SESSION?.tenantId || 'local';
    localStorage.setItem(`dashboardBgConfig_${tenant}`, JSON.stringify({ cor, imagem }));
  };

  // Logout de contingência. tenant-runtime.js substitui quando a sessão Supabase estiver pronta.
  window.logout = function logout() {
    localStorage.removeItem('usuarioLogado');
    location.href = 'index.html';
  };

  function importExternalAssetFromQuery() {
    const params = new URLSearchParams(location.search);
    const hostname = params.get('hostname');
    const usuario = params.get('usuario');
    const etiqueta = params.get('etiqueta');
    const setorNome = params.get('setor');
    const descricao = params.get('descricao') || '';
    if (!hostname || !setorNome || !etiqueta) return;

    let lista = [];
    try { lista = JSON.parse(localStorage.getItem('setores') || '[]'); } catch {}
    if (!Array.isArray(lista)) lista = [];

    let setor = lista.find(item => item?.nome === setorNome);
    if (!setor) {
      setor = { nome: setorNome, maquinas: [] };
      lista.push(setor);
    }
    if (!Array.isArray(setor.maquinas)) setor.maquinas = [];
    if (setor.maquinas.some(item => item?.etiqueta === etiqueta)) return;

    setor.maquinas.push({
      id: crypto?.randomUUID?.() || `asset_${Date.now()}`,
      nome: hostname,
      etiqueta,
      modelo: descricao,
      setor: setorNome,
      usuarioResponsavel: usuario || '',
      tipo: 'PC',
      chamado: [],
      chamados: [],
      atualizadoEm: new Date().toISOString()
    });
    localStorage.setItem('setores', JSON.stringify(lista));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      restoreLegacyProfileImage();
      importExternalAssetFromQuery();
    }, { once: true });
  } else {
    restoreLegacyProfileImage();
    importExternalAssetFromQuery();
  }
})();
