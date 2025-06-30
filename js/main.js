const usuarios = [
  { nome: "admin", senha: "admin123", role: "admin" },
  { nome: "joao", senha: "1234", role: "tecnico" },
  { nome: "maria", senha: "abcd", role: "viewer" }
];

function login() {
  const user = document.getElementById("username").value.trim();
  const pass = document.getElementById("password").value;

  const encontrado = usuarios.find(u => u.nome === user && u.senha === pass);
  
  if (encontrado) {
    sessionStorage.setItem("loggedUser", encontrado.nome);
    sessionStorage.setItem("userRole", encontrado.role);
    window.location.href = "dashboard.html"; // ou onde for o seu painel
  } else {
    document.getElementById("loginError").style.display = "block";
  }
}
