// js/permissoes.js

export function verificarPermissoes() {
  const usuario = JSON.parse(localStorage.getItem("usuarioLogado"));
  const adminMenu = document.getElementById("adminMenu");

  if (!usuario || !adminMenu) return;

  // Só exibe o botão se for admin
  if (usuario.perfil === "admin") {
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
