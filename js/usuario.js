// Compatibilidade de interface do usuário.
// Autenticação real é responsabilidade de auth-v2.js / tenant-runtime.js.

function toggleUserMenu(event) {
  if (event) event.stopPropagation();
  const dropdown = document.getElementById('userDropdown');
  if (!dropdown) return;
  const aberto = !dropdown.hidden && dropdown.style.display !== 'none';
  dropdown.hidden = aberto;
  dropdown.style.display = aberto ? 'none' : 'block';
}

function mostrarNomeUsuario() {
  const nome = window.RRN_SESSION?.name;
  let compat = null;
  try { compat = JSON.parse(localStorage.getItem('usuarioLogado') || 'null'); } catch {}
  const userName = document.getElementById('userName');
  if (userName) userName.textContent = nome || compat?.nome || compat?.email || 'Usuário';
}

async function logout(button) {
  if (button?.classList.contains('animate')) return;
  button?.classList.add('animate');

  if (typeof window.RRN_SECURE_LOGOUT === 'function') {
    await window.RRN_SECURE_LOGOUT();
    return;
  }

  localStorage.removeItem('usuarioLogado');
  sessionStorage.removeItem('loggedUser');
  location.replace('index.html');
}

document.addEventListener('click', event => {
  const userMenu = document.querySelector('.user-menu');
  const dropdown = document.getElementById('userDropdown');
  if (!userMenu || !dropdown || userMenu.contains(event.target)) return;
  dropdown.hidden = true;
  dropdown.style.display = 'none';
});

document.addEventListener('DOMContentLoaded', mostrarNomeUsuario);
