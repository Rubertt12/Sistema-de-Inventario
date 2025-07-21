// Alternância de abas (login / cadastro)
const tabLogin = document.getElementById("tabLogin");
const tabCadastro = document.getElementById("tabCadastro");
const formLogin = document.getElementById("formLogin");
const formCadastro = document.getElementById("formCadastro");
const cadastroMsg = document.getElementById("cadastroMsg");
const loginMsg = document.getElementById("loginMsg");

tabLogin.onclick = () => toggleTab("login");
tabCadastro.onclick = () => toggleTab("cadastro");

function toggleTab(tab) {
  formLogin.classList.toggle("active", tab === "login");
  formCadastro.classList.toggle("active", tab === "cadastro");
  tabLogin.classList.toggle("active", tab === "login");
  tabCadastro.classList.toggle("active", tab === "cadastro");

  // Limpa mensagens quando troca de aba
  cadastroMsg.textContent = "";
  cadastroMsg.style.color = "";
  loginMsg.textContent = "";
}

// Cadastro de usuário
formCadastro.onsubmit = (e) => {
  e.preventDefault();

  const nome = document.getElementById("cadastroNome").value.trim();
  const senha = document.getElementById("cadastroSenha").value;
  const perfil = document.getElementById("cadastroPerfil").value;

  if (!nome || !senha || !perfil) {
    cadastroMsg.style.color = "red";
    cadastroMsg.textContent = "Preencha todos os campos.";
    return;
  }

  let usuarios = JSON.parse(localStorage.getItem("usuarios") || "[]");

  if (usuarios.some(u => u.nome.toLowerCase() === nome.toLowerCase())) {
    cadastroMsg.style.color = "red";
    cadastroMsg.textContent = "Usuário já cadastrado!";
    return;
  }

  usuarios.push({ nome, senha, perfil });
  localStorage.setItem("usuarios", JSON.stringify(usuarios));

  cadastroMsg.style.color = "green";
  cadastroMsg.textContent = "Cadastro realizado com sucesso!";
  e.target.reset();

  setTimeout(() => toggleTab("login"), 1500);
};

// Login
formLogin.onsubmit = (e) => {
  e.preventDefault();

  const nome = document.getElementById("loginUsuario").value.trim();
  const senha = document.getElementById("loginSenha").value;

  const usuarios = JSON.parse(localStorage.getItem("usuarios") || "[]");
  const user = usuarios.find(u => u.nome.toLowerCase() === nome.toLowerCase() && u.senha === senha);

  if (!user) {
    loginMsg.style.color = "red";
    loginMsg.textContent = "Usuário ou senha inválidos.";
    return;
  }

  localStorage.setItem("usuarioLogado", JSON.stringify(user));
  window.location.href = "dashboard.html"; // Ajuste conforme sua página inicial
};

// Exibir nome do usuário logado na página (se existir)
window.addEventListener("DOMContentLoaded", () => {
  const user = JSON.parse(localStorage.getItem("usuarioLogado"));
  if (user && user.nome) {
    const userNameElem = document.getElementById("userName");
    if (userNameElem) {
      userNameElem.textContent = user.nome;
    }
  }
});
window.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);

  const hostname = urlParams.get('hostname');
  const usuario = urlParams.get('usuario');
  const etiqueta = urlParams.get('etiqueta');
  const setorNome = urlParams.get('setor');
  const descricao = urlParams.get('descricao') || '';

  if (!hostname || !setorNome || !etiqueta) return;

  let setores = JSON.parse(localStorage.getItem('setores')) || [];

  let setor = setores.find(s => s.nome === setorNome);

  if (!setor) {
    setor = {
      nome: setorNome,
      maquinas: []
    };
    setores.push(setor);
  }

  const maquinaExistente = setor.maquinas.find(m => m.etiqueta === etiqueta);
  if (!maquinaExistente) {
    const novaMaquina = {
      id: Date.now(),
      nome: hostname,
      etiqueta: etiqueta,
      modelo: descricao,
      setor: setorNome,
      usuarioResponsavel: usuario || '',
      tipo: "PC",
      chamado: []
    };

    setor.maquinas.push(novaMaquina);
    console.log(`Máquina adicionada: ${hostname} no setor ${setorNome}.`);
  } else {
    console.log(`Máquina já existe: ${etiqueta} no setor ${setorNome}.`);
  }

  localStorage.setItem('setores', JSON.stringify(setores));

  if (typeof renderSetores === 'function') renderSetores();
});
