// Verifica se o usuário está logado ao carregar a Dashboard
document.addEventListener("DOMContentLoaded", function () {
    const currentPage = window.location.pathname.split("/").pop(); // Obtém o nome da página atual

    if (currentPage === "dashboard.html" && !localStorage.getItem("userLoggedIn")) {
        window.location.href = "index.html"; // Redireciona para login se não estiver autenticado
    }
});

// Função de login
function login() {
    const usuario = document.getElementById("usuario").value;
    const senha = document.getElementById("senha").value;

    // Simulando um usuário fixo (troque para validar com backend se necessário)
    if (usuario === "admin" && senha === "1234") {
        localStorage.setItem("userLoggedIn", "true"); // Armazena o login
        window.location.href = "dashboard.html"; // Redireciona para a Dashboard
    } else {
        alert("Usuário ou senha incorretos!");
    }
}

// Função de logout
function logout() {
    localStorage.removeItem("userLoggedIn"); // Remove o login
    window.location.href = "index.html"; // Redireciona para login
}
