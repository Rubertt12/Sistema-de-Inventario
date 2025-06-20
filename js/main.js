function toggleMenu() {
  document.querySelector('.nav-links').classList.toggle('active');
}

// Toggle do menu do usuário (abre e fecha)
function toggleUserMenu() {
  const dropdown = document.getElementById('userDropdown');
  dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
}

// Fecha menu do usuário ao clicar fora dele
document.addEventListener('click', function(event) {
  const userMenu = document.querySelector('.user-menu');
  const dropdown = document.getElementById('userDropdown');
  
  if (dropdown.style.display === 'block' && !userMenu.contains(event.target)) {
    dropdown.style.display = 'none';
  }
});

// Logout com animação do emoji da porta
function logout(button) {
  if (button.classList.contains('animate')) return;

  if (!button.querySelector('span')) {
    const parts = button.innerHTML.split('🚪');
    button.innerHTML = `${parts[0]}<span>🚪</span>`;
  }

  button.classList.add('animate');

  setTimeout(() => {
    console.log('Tchau, piazito! 👋');
    sessionStorage.removeItem('loggedUser'); // só um item por vez!
    window.location.href = 'index.html';
  }, 700);
}

// Mostrar nome do usuário no menu ao carregar a página
document.addEventListener('DOMContentLoaded', function() {
  const user = sessionStorage.getItem('loggedUser') || 'Usuário';
  const userNameElem = document.getElementById('userName');
  if (userNameElem) {
    userNameElem.textContent = user;
  }
});

// Abrir modal de configurações e fechar dropdown do usuário
function openConfigModal() {
  document.getElementById('configModal').style.display = 'block';
  const dropdown = document.getElementById('userDropdown');
  if (dropdown) dropdown.style.display = 'none';
}

// Fechar modal de configurações
function closeConfigModal() {
  const modal = document.getElementById('configModal');
  if (modal) modal.style.display = 'none';
}

// Alterar foto de perfil e atualizar no menu
function changeProfilePicture(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const profilePic = document.getElementById('profilePic');
      const userAvatar = document.getElementById('userAvatar');
      if (profilePic) profilePic.src = e.target.result;
      if (userAvatar) userAvatar.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
}
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

  const userData = {
    email,
    user,
    pass,
    phone
  };

  localStorage.setItem(`user_${user}`, JSON.stringify(userData));
  alert("Cadastro feito com sucesso! Agora entra ali no login.");

  // Limpa os campos
  document.getElementById("registerEmail").value = "";
  document.getElementById("registerUser").value = "";
  document.getElementById("registerPass").value = "";
  document.getElementById("registerPhone").value = "";

  toggleForms();
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

  // Aqui você pode validar o 2FA, se quiser, mas vou deixar só o alerta
  if (code) {
    alert(`Login com 2FA validado! Bem-vindo, ${userData.user}!`);
  } else {
    alert(`Login realizado sem 2FA. Bem-vindo, ${userData.user}!`);
  }

  // Salva no sessionStorage o nome do usuário logado para usar no menu depois
  sessionStorage.setItem("loggedUser", userData.user);

  // Redireciona para dashboard
  window.location.href = "dashboard.html";
}

window.onload = () => {
  document.activeElement.blur();
};
document.addEventListener('DOMContentLoaded', function() {
  const user = sessionStorage.getItem('loggedUser') || 'Usuário';
  const userNameElem = document.getElementById('userName');
  if (userNameElem) {
    userNameElem.textContent = user;
  }
});
