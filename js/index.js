document.getElementById("formLogin").onsubmit = (e) => {
  e.preventDefault();

  const nome = document.getElementById("loginUsuario").value.trim();
  const senha = document.getElementById("loginSenha").value;
  const loginMsg = document.getElementById("loginMsg");

  const usuarios = JSON.parse(localStorage.getItem("usuarios") || "[]");

  const user = usuarios.find(u => u.nome === nome && u.senha === senha);

  if (!user) {
    loginMsg.textContent = "Usuário ou senha inválidos.";
    loginMsg.style.color = "red";
    return;
  }

  localStorage.setItem("usuarioLogado", JSON.stringify(user));
  window.location.href = "dashboard.html"; // Altere para sua tela inicial
};

