// js/permissoes.js

export function verificarPermissoes() {
  const usuario = JSON.parse(localStorage.getItem("usuarioLogado"));
  const adminMenu = document.getElementById("adminMenu");

  if (!usuario || !adminMenu) return;

  // Mostrar botão para admin e editor (se quiser só admin, tire o editor)
  if (usuario.perfil === "admin" || usuario.perfil === "") {
    adminMenu.style.display = "block";
  } else {
    adminMenu.style.display = "none";
  }
}


localStorage.setItem("usuarioLogado", JSON.stringify({ nome: "AdmRubertt", perfil: "admin" }));
function abrirPaginaUsuarios() {
  window.location.href = 'usuarios.html'; // Ou o caminho correto do seu arquivo
}



  document.addEventListener("DOMContentLoaded", () => {
    const usuarioLogado = JSON.parse(localStorage.getItem('usuarioLogado'));

    if (!usuarioLogado) {
      alert("Você precisa estar logado!");
      window.location.href = 'index.html';
      return;
    }

    // Mostra o menu somente se o usuário for admin ou editor
    if (usuarioLogado.perfil === 'admin' || usuarioLogado.perfil === 'editor') {
      document.getElementById("adminMenu").style.display = "block";
    }
  });

  function abrirPaginaUsuarios() {
    window.location.href = 'usuarios.html';
  }


  function verificarLogin() {
  const usuarioLogado = JSON.parse(localStorage.getItem('usuarioLogado'));
  if (!usuarioLogado || !usuarioLogado.nome) {
    alert('Você precisa estar logado para acessar esta página.');
    window.location.href = 'login.html'; // Ajuste para o nome correto do seu arquivo de login
  }
}

// Chama a verificação na carga da página
verificarLogin();

// Garante que, se o usuário usar o botão voltar do navegador, a checagem também será feita
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    verificarLogin();
  }
});


function logout() {
  localStorage.removeItem('usuarioLogado');
  window.location.href = 'index.html'; // vai pro login de novo
}



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
function tentarLogin(nomeDigitado, senhaDigitada) {
  let usuarios = JSON.parse(localStorage.getItem('usuarios')) || [];

  garantirSuperAdmin();  // Garante superadmin sempre antes da validação

  // Recarrega lista atualizada após garantir superadmin
  usuarios = JSON.parse(localStorage.getItem('usuarios')) || [];

  const usuario = usuarios.find(u => u.nome.toLowerCase() === nomeDigitado.toLowerCase() && u.senha === senhaDigitada);
  if (usuario) {
    localStorage.setItem('usuarioLogado', JSON.stringify(usuario));
    // Redireciona ou faz o que precisa no login
  } else {
    alert('Usuário ou senha incorretos!');
  }
}
