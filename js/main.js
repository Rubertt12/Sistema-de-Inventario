// Alternância de abas
document.getElementById("tabLogin").onclick = () => {
  toggleTab("login");
};
document.getElementById("tabCadastro").onclick = () => {
  toggleTab("cadastro");
};

function toggleTab(tab) {
  document.getElementById("formLogin").classList.toggle("active", tab === "login");
  document.getElementById("formCadastro").classList.toggle("active", tab === "cadastro");
  document.getElementById("tabLogin").classList.toggle("active", tab === "login");
  document.getElementById("tabCadastro").classList.toggle("active", tab === "cadastro");
}

// Cadastro
document.getElementById("formCadastro").onsubmit = (e) => {
  e.preventDefault();

  const nome = document.getElementById("cadastroNome").value.trim();
  const senha = document.getElementById("cadastroSenha").value;
  const perfil = document.getElementById("cadastroPerfil").value;

  if (!nome || !senha || !perfil) {
    document.getElementById("cadastroMsg").textContent = "Preencha todos os campos.";
    return;
  }

  let usuarios = JSON.parse(localStorage.getItem("usuarios") || "[]");

  if (usuarios.some(u => u.nome.toLowerCase() === nome.toLowerCase())) {
    document.getElementById("cadastroMsg").textContent = "Usuário já cadastrado!";
    return;
  }

  usuarios.push({ nome, senha, perfil });
  localStorage.setItem("usuarios", JSON.stringify(usuarios));
  document.getElementById("cadastroMsg").style.color = "green";
  document.getElementById("cadastroMsg").textContent = "Cadastro realizado com sucesso!";
  e.target.reset();
  setTimeout(() => toggleTab("login"), 1000);
};

// Login
document.getElementById("formLogin").onsubmit = (e) => {
  e.preventDefault();

  const nome = document.getElementById("loginUsuario").value.trim();
  const senha = document.getElementById("loginSenha").value;

  const usuarios = JSON.parse(localStorage.getItem("usuarios") || "[]");
  const user = usuarios.find(u => u.nome === nome && u.senha === senha);

  if (!user) {
    document.getElementById("loginMsg").textContent = "Usuário ou senha inválidos.";
    return;
  }

  localStorage.setItem("usuarioLogado", JSON.stringify(user));
  window.location.href = "dashboard.html"; // ajuste conforme sua página inicial
};

function realizarLogin() {
  const nome = document.getElementById("nome").value;
  const senha = document.getElementById("senha").value;

  const usuarios = JSON.parse(localStorage.getItem("usuarios")) || [];
  const user = usuarios.find(u => u.nome === nome && u.senha === senha);

  if (user) {
    localStorage.setItem("usuarioLogado", JSON.stringify(user));
    window.location.href = "dashboard.html"; // ou onde estiver seu painel
  } else {
    alert("Usuário ou senha inválidos");
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const user = JSON.parse(localStorage.getItem("usuarioLogado"));
  if (user && user.nome) {
    document.getElementById("userName").textContent = user.nome;
  }
});