// Utilitários globais do dashboard. Autenticação e tenant ficam em auth-v2.js / tenant-runtime.js.

function toggleMenu() {
  document.querySelector('.nav-links')?.classList.toggle('active');
}

function toggleUserMenu(event) {
  if (event) event.stopPropagation();
  const dropdown = document.getElementById('userDropdown');
  if (!dropdown) return;
  const aberto = !dropdown.hidden && dropdown.style.display !== 'none';
  dropdown.hidden = aberto;
  dropdown.style.display = aberto ? 'none' : 'block';
}

document.addEventListener('click', event => {
  const menu = document.querySelector('.user-menu');
  const dropdown = document.getElementById('userDropdown');
  if (!menu || !dropdown || menu.contains(event.target)) return;
  dropdown.hidden = true;
  dropdown.style.display = 'none';
});

function openConfigModal() {
  const modal = document.getElementById('configModal');
  if (!modal) return;
  modal.removeAttribute('hidden');
  modal.style.display = 'flex';
  const dropdown = document.getElementById('userDropdown');
  if (dropdown) {
    dropdown.hidden = true;
    dropdown.style.display = 'none';
  }
}

function closeConfigModal() {
  const modal = document.getElementById('configModal');
  if (!modal) return;
  modal.style.display = 'none';
}

window.addEventListener('click', event => {
  const modal = document.getElementById('configModal');
  if (event.target === modal) closeConfigModal();
});

function changeProfilePicture(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) return alert('Selecione uma imagem válida.');
  if (file.size > 2 * 1024 * 1024) return alert('A imagem deve ter no máximo 2 MB.');

  const reader = new FileReader();
  reader.onload = e => {
    const value = e.target.result;
    const profile = document.getElementById('profilePic');
    const avatar = document.getElementById('userAvatar');
    if (profile) profile.src = value;
    if (avatar) avatar.src = value;
    localStorage.setItem('userProfileImage', value);
  };
  reader.readAsDataURL(file);
}

document.addEventListener('DOMContentLoaded', () => {
  const savedImage = localStorage.getItem('userProfileImage');
  if (savedImage) {
    const profile = document.getElementById('profilePic');
    const avatar = document.getElementById('userAvatar');
    if (profile) profile.src = savedImage;
    if (avatar) avatar.src = savedImage;
  }
});

function exportarBackupJSON() {
  const dados = {
    versao: 2,
    exportadoEm: new Date().toISOString(),
    tenant: window.RRN_SESSION?.tenantId || null,
    setores: typeof setores !== 'undefined' ? setores : JSON.parse(localStorage.getItem('setores') || '[]'),
    chamados: JSON.parse(localStorage.getItem('chamados') || '[]')
  };
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `backup-inventario-${new Date().toISOString().slice(0,10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function importarBackupJSON(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const dados = JSON.parse(e.target.result);
      if (!Array.isArray(dados.setores)) throw new Error('O arquivo não contém uma lista válida de setores.');
      localStorage.setItem('setores', JSON.stringify(dados.setores));
      localStorage.setItem('chamados', JSON.stringify(Array.isArray(dados.chamados) ? dados.chamados : []));
      alert('Backup restaurado com sucesso.');
      location.reload();
    } catch (error) {
      alert(`Não foi possível importar o backup: ${error.message}`);
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsText(file);
}

function toggleChecklist(legendElement) {
  legendElement?.parentElement?.classList.toggle('collapsed');
}

function abrirPaginaUsuarios() {
  location.href = 'usuarios.html';
}

function salvarConfigBackground({ cor = null, imagem = null } = {}) {
  const tenant = window.RRN_SESSION?.tenantId || 'local';
  localStorage.setItem(`dashboardBgConfig_${tenant}`, JSON.stringify({ cor, imagem }));
}

// Logout de contingência. tenant-runtime.js substitui esta função quando a sessão Supabase estiver pronta.
function logout() {
  localStorage.removeItem('usuarioLogado');
  location.href = 'index.html';
}

// Compatibilidade com links externos que adicionam um equipamento via query string.
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(location.search);
  const hostname = params.get('hostname');
  const usuario = params.get('usuario');
  const etiqueta = params.get('etiqueta');
  const setorNome = params.get('setor');
  const descricao = params.get('descricao') || '';
  if (!hostname || !setorNome || !etiqueta) return;

  const lista = JSON.parse(localStorage.getItem('setores') || '[]');
  let setor = lista.find(item => item.nome === setorNome);
  if (!setor) {
    setor = { nome: setorNome, maquinas: [] };
    lista.push(setor);
  }
  if (!Array.isArray(setor.maquinas)) setor.maquinas = [];
  if (!setor.maquinas.some(item => item.etiqueta === etiqueta)) {
    setor.maquinas.push({
      id: Date.now(),
      nome: hostname,
      etiqueta,
      modelo: descricao,
      setor: setorNome,
      usuarioResponsavel: usuario || '',
      tipo: 'PC',
      chamado: []
    });
    localStorage.setItem('setores', JSON.stringify(lista));
  }
});
