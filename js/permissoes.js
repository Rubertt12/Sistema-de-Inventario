// Helper de permissões para páginas que ainda importam este módulo.
// Não cria usuários, não grava senha e não concede perfil administrativo.

function readCompatUser() {
  try {
    return JSON.parse(localStorage.getItem('usuarioLogado') || 'null');
  } catch {
    return null;
  }
}

function currentRole() {
  return window.RRN_SESSION?.role || readCompatUser()?.perfil || null;
}

export function verificarPermissoes() {
  const role = currentRole();
  const adminMenu = document.getElementById('adminMenu');
  const canOperate = role === 'admin' || role === 'operador';
  const isAdmin = role === 'admin';

  if (adminMenu) adminMenu.style.display = isAdmin ? 'block' : 'none';

  document.querySelectorAll('.admin-only').forEach(element => {
    element.style.display = isAdmin ? '' : 'none';
  });

  document.querySelectorAll('.operador-only').forEach(element => {
    element.style.display = canOperate ? '' : 'none';
  });

  return { role, canOperate, isAdmin };
}

export function abrirPaginaUsuarios() {
  if (currentRole() !== 'admin') return false;
  location.href = 'usuarios.html';
  return true;
}

export async function logout() {
  if (typeof window.RRN_SECURE_LOGOUT === 'function') {
    await window.RRN_SECURE_LOGOUT();
    return;
  }
  localStorage.removeItem('usuarioLogado');
  location.replace('index.html');
}

if (typeof window !== 'undefined') {
  window.verificarPermissoesV2 = verificarPermissoes;
}
