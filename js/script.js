// ======= TOGGLE MENU =======
function toggleMenu() {
  document.querySelector('.nav-links').classList.toggle('active');
}

// Toggle do menu do usuário (abre e fecha)
function toggleUserMenu() {
  const dropdown = document.getElementById('userDropdown');
  dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
}

// Fecha menu do usuário ao clicar fora
document.addEventListener('click', function(event) {
  const userMenu = document.querySelector('.user-menu');
  const dropdown = document.getElementById('userDropdown');
  if (dropdown.style.display === 'block' && !userMenu.contains(event.target)) {
    dropdown.style.display = 'none';
  }
});

// ======= AUTENTICAÇÃO =======
function toggleForms() {
  document.getElementById("loginContainer").classList.toggle("hidden");
  document.getElementById("registerContainer").classList.toggle("hidden");
}

function register() {
  const email = document.getElementById("registerEmail").value.trim();
  const user = document.getElementById("registerUser").value.trim();
  const pass = document.getElementById("registerPass").value;
  const phone = document.getElementById("registerPhone").value.trim();

  if (!email || !user || !pass || !phone) {
    alert("Preenche todos os campos, tchê!");
    return;
  }

  if (localStorage.getItem(`user_${user}`)) {
    alert("Usuário já existe! Escolhe outro nome.");
    return;
  }

  const userData = { email, user, pass, phone };
  localStorage.setItem(`user_${user}`, JSON.stringify(userData));
  alert("Cadastro feito com sucesso! Agora entra ali no login.");

  clearRegisterFields();
  toggleForms();
}

function clearRegisterFields() {
  document.getElementById("registerEmail").value = "";
  document.getElementById("registerUser").value = "";
  document.getElementById("registerPass").value = "";
  document.getElementById("registerPhone").value = "";
}

function login() {
  const loginInput = document.getElementById("loginUser").value.trim();
  const password = document.getElementById("loginPass").value;
  const code = document.getElementById("login2FA").value.trim();

  if (!loginInput || !password) {
    alert("Preenche usuário e senha, vivente!");
    return;
  }

  const storedData = localStorage.getItem(`user_${loginInput}`);
  if (!storedData) {
    alert("Usuário não encontrado.");
    return;
  }

  const userData = JSON.parse(storedData);

  if (userData.pass !== password) {
    alert("Senha incorreta!");
    return;
  }

  if (code) {
    alert(`Login com 2FA validado! Bem-vindo, ${userData.user}!`);
  } else {
    alert(`Login realizado sem 2FA. Bem-vindo, ${userData.user}!`);
  }

  sessionStorage.setItem("loggedUser", userData.user);
  window.location.href = "dashboard.html";
}

// ======= LOGOUT =======
function logout(button) {
  if (button.classList.contains('animate')) return;

  if (!button.querySelector('span')) {
    const parts = button.innerHTML.split('🚪');
    button.innerHTML = `${parts[0]}<span>🚪</span>`;
  }

  button.classList.add('animate');

  setTimeout(() => {
    console.log('Tchau, piazito! 👋');
    sessionStorage.removeItem('loggedUser');
    window.location.href = 'index.html';
  }, 700);
}

// ======= MODAL DE CONFIGURAÇÕES =======
function openConfigModal() {
  document.getElementById('configModal').style.display = 'block';
  const dropdown = document.getElementById('userDropdown');
  if (dropdown) dropdown.style.display = 'none';
}

function closeConfigModal() {
  const modal = document.getElementById('configModal');
  if (modal) modal.style.display = 'none';
}

// ======= ALTERAÇÃO DE FOTO DE PERFIL =======
function changeProfilePicture(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = function (e) {
    const base64Image = e.target.result;

    // Atualiza a imagem no perfil
    const imgElement = document.getElementById("profilePic");
    imgElement.src = base64Image;

    // Salva no localStorage
    localStorage.setItem("userProfileImage", base64Image);
  };

  reader.readAsDataURL(file);
}


window.addEventListener("DOMContentLoaded", function () {
  const savedImage = localStorage.getItem("userProfileImage");
  if (savedImage) {
    document.getElementById("profilePic").src = savedImage;
    document.getElementById("userAvatar").src = savedImage;
  }
});

// ======= INICIALIZAÇÃO =======
window.onload = () => {
  document.activeElement.blur();
};

document.addEventListener('DOMContentLoaded', function() {
  const user = sessionStorage.getItem('loggedUser') || 'Usuário';
  const userNameElem = document.getElementById('userName');
  if (userNameElem) userNameElem.textContent = user;
});


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
function exportarBackupJSON() {
  const dados = {
    setores: setores,
    chamados: JSON.parse(localStorage.getItem('chamados')) || []
  };
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'backup-inventario.json';
  a.click();
  URL.revokeObjectURL(url);
}



function importarBackupJSON(event) {
  const file = event.target.files[0];
  if (!file) return alert("Selecione um arquivo JSON válido.");

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const dados = JSON.parse(e.target.result);
      if (!dados.setores || !Array.isArray(dados.setores)) throw "Formato inválido";

      localStorage.setItem('setores', JSON.stringify(dados.setores));
      localStorage.setItem('chamados', JSON.stringify(dados.chamados || []));

      alert("Backup restaurado com sucesso!");
      window.location.reload();
    } catch (err) {
      alert("Erro ao importar backup: " + err);
    }
  };
  reader.readAsText(file);
}


function toggleChecklist(legendElement) {
  const fieldset = legendElement.parentElement;
  fieldset.classList.toggle('collapsed');
}


// Após validar o login com sucesso
localStorage.setItem('usuarioLogado', JSON.stringify(user));
window.location.href = "dashboard.html"; // redireciona para o dashboard




// Controle do modal
const userModal = document.getElementById('userModal');
const openUserModalBtn = document.getElementById('openUserModalBtn');
const closeUserModalBtn = document.getElementById('closeUserModalBtn');

openUserModalBtn.addEventListener('click', () => {
  userModal.classList.add('show');
  loadUsersTable();
});

closeUserModalBtn.addEventListener('click', () => {
  userModal.classList.remove('show');
});

window.addEventListener('click', e => {
  if (e.target === userModal) userModal.classList.remove('show');
});

// Função para salvar usuários no localStorage
function getUsers() {
  const users = localStorage.getItem('users');
  return users ? JSON.parse(users) : [];
}

function saveUsers(users) {
  localStorage.setItem('users', JSON.stringify(users));
}

// Formulário
const userForm = document.getElementById('userForm');
userForm.addEventListener('submit', e => {
  e.preventDefault();

  const name = userForm.userName.value.trim();
  const email = userForm.userEmail.value.trim().toLowerCase();
  const password = userForm.userPassword.value;
  const profile = userForm.userProfile.value;

  if (!name || !email || !password || !profile) {
    alert('Preencha todos os campos corretamente!');
    return;
  }

  // Validação simples email
  if (!email.match(/^\S+@\S+\.\S+$/)) {
    alert('Email inválido!');
    return;
  }

  if (password.length < 6) {
    alert('A senha deve ter no mínimo 6 caracteres!');
    return;
  }

  let users = getUsers();

  // Verifica se email já existe
  if (users.find(u => u.email === email)) {
    alert('Este email já está cadastrado!');
    return;
  }

  users.push({ id: Date.now(), name, email, password, profile });
  saveUsers(users);

  alert('Usuário cadastrado com sucesso!');

  userForm.reset();
  loadUsersTable();
});

// Listagem usuários
function loadUsersTable() {
  const tbody = document.querySelector('#usersTable tbody');
  const users = getUsers();
  tbody.innerHTML = '';

  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Nenhum usuário cadastrado.</td></tr>';
    return;
  }

  users.forEach(user => {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>${user.name}</td>
      <td>${user.email}</td>
      <td>${user.profile.charAt(0).toUpperCase() + user.profile.slice(1)}</td>
      <td>
        <button class="delete-btn" data-id="${user.id}" style="background-color:#e74c3c; padding: 4px 8px; border-radius:6px; color:#fff; font-weight:bold; cursor:pointer;">Excluir</button>
      </td>
    `;

    tbody.appendChild(tr);
  });

  // Adiciona evento para exclusão
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const id = Number(e.target.getAttribute('data-id'));
      if (confirm('Tem certeza que deseja excluir este usuário?')) {
        deleteUser(id);
      }
    });
  });
}

function deleteUser(id) {
  let users = getUsers();
  users = users.filter(u => u.id !== id);
  saveUsers(users);
  loadUsersTable();
}


function verificarPermissao() {
  const usuarioLogado = JSON.parse(localStorage.getItem('usuarioLogado'));
  if (usuarioLogado && usuarioLogado.permissao === 'admin') {
    document.getElementById('adminMenu').style.display = 'block';
  }
}

verificarPermissao();


let usuarios = [
  {
    nome: "admin",
    senha: "Yugioh22@",
    permissao: "admin"
  },
  {
    nome: "João",
    senha: "abc",
    permissao: "editor"
  }
];
localStorage.setItem('usuarios', JSON.stringify(usuarios));


function loginUsuario(nome, senha) {
  const usuarios = JSON.parse(localStorage.getItem('usuarios')) || [];
  const usuario = usuarios.find(u => u.nome === nome && u.senha === senha);

  if (usuario) {
    localStorage.setItem('usuarioLogado', JSON.stringify(usuario));
    location.href = 'dashboard.html';
  } else {
    alert('Usuário ou senha inválidos!');
  }
}

function abrirPaginaUsuarios() {
  window.location.href = 'usuarios.html'; // Ou o caminho correto do seu arquivo
}


const usuario = JSON.parse(localStorage.getItem("usuarioLogado"));
const nomeUsuario = usuario ? usuario.nome : "guest";

// Função para salvar configuração do usuário
function salvarConfigBackground({ cor, imagem }) {
  const config = {
    cor: cor || null,
    imagem: imagem || null
  };
  localStorage.setItem(`dashboardBgConfig_${nomeUsuario}`, JSON.stringify(config));
}



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
