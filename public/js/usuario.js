// Alterna visibilidade do dropdown do usuário
function toggleUserMenu(event) {
  event.stopPropagation(); // impede fechamento imediato ao clicar no botão
  const dropdown = document.getElementById("userDropdown");
  dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
}

// Função para logout com animação no botão
function logout(button) {
  if (button.classList.contains('animate')) return; // evita logout duplicado durante animação

  // Se ainda não tem o span com o emoji da porta, adiciona
  if (!button.querySelector('span')) {
    const parts = button.innerHTML.split('🚪');
    button.innerHTML = `${parts[0]}<span>🚪</span>`;
  }

  const door = button.querySelector('span');
  button.classList.add('animate');

  setTimeout(() => {
    console.log("Tchau, piazito! 👋");
    sessionStorage.removeItem("loggedUser");
    window.location.href = "index.html";
  }, 700);
}

// Exibe o nome do usuário salvo na sessão, ou "Usuário" padrão
function mostrarNomeUsuario() {
  const user = sessionStorage.getItem("loggedUser") || "Usuário";
  document.getElementById("userName").textContent = user;
}

// Fecha o menu de usuário ao clicar fora dele
document.addEventListener("click", function(event) {
  const userMenu = document.querySelector(".user-menu");
  const dropdown = document.getElementById("userDropdown");
  if (!userMenu.contains(event.target)) {
    dropdown.style.display = "none";
  }
});

// Atualiza o nome do usuário quando a página carrega
document.addEventListener('DOMContentLoaded', () => {
  mostrarNomeUsuario();
});
let usuarios = JSON.parse(localStorage.getItem('usuarios')) || [];

// Função para garantir superadmin
function garantirSuperAdmin() {
  const existeSuperAdmin = usuarios.some(u => u.nome === 'superadmin');
  if (!existeSuperAdmin) {
    usuarios.unshift({ nome: 'superadmin', senha: 'suP3r@dm1n!', perfil: 'admin' });
    localStorage.setItem('usuarios', JSON.stringify(usuarios));
  }
}

// Chama antes de validar login
garantirSuperAdmin();

// Depois faça a validação com a lista 'usuarios' já atualizada
