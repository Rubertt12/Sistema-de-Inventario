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
  reader.onload = function(e) {
    const profilePic = document.getElementById('profilePic');
    const userAvatar = document.getElementById('userAvatar');
    if (profilePic) profilePic.src = e.target.result;
    if (userAvatar) userAvatar.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ======= INICIALIZAÇÃO =======
window.onload = () => {
  document.activeElement.blur();
};

document.addEventListener('DOMContentLoaded', function() {
  const user = sessionStorage.getItem('loggedUser') || 'Usuário';
  const userNameElem = document.getElementById('userName');
  if (userNameElem) userNameElem.textContent = user;
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
