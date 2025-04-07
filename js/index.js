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
  
    if (code) {
      alert(`Login com 2FA validado! Bem-vindo, ${userData.user}!`);
    } else {
      alert(`Login realizado sem 2FA. Bem-vindo, ${userData.user}!`);
    }
  
    // qui tu pode redirecionar, exibir dados, etc.
    window.location.href = "dashboard.html";
  }
  