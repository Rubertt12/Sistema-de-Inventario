// Cria usuário admin padrão se não existir
let usuarios = JSON.parse(localStorage.getItem('usuarios')) || [];

if (!usuarios.find(u => u.nome === 'admin')) {
  usuarios.push({
    nome: 'admin',
    senha: 'L7QKP09r09d$',
    perfil: 'admin'
  });
  localStorage.setItem('usuarios', JSON.stringify(usuarios));
  alert('Usuário padrão criado:\n\nUsuário: admin\nSenha: L7QKP09r09d$\nPerfil: administrador');
}

// Login
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
  window.location.href = "dashboard.html"; // Ajuste aqui se quiser outra página
};
