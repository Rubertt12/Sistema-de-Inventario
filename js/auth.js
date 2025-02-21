document.addEventListener("DOMContentLoaded", function () {
    const currentPage = window.location.pathname.split("/").pop(); // Obtém o nome da página atual
    const isLoggedIn = localStorage.getItem("userLoggedIn"); // Verifica se está logado

    if (currentPage === "dashboard.html" && !isLoggedIn) {
        window.location.href = "index.html"; // Redireciona para login se não estiver autenticado
    }
});

// Função de login
function login() {
    const usuario = document.getElementById("usuario").value;
    const senha = document.getElementById("senha").value;

    // Simulando um usuário fixo (substitua por validação de backend se necessário)
    if (usuario === "admin" && senha === "1234") {
        localStorage.setItem("userLoggedIn", "true"); // Define que o usuário está logado
        window.location.href = "dashboard.html"; // Redireciona para a Dashboard
    } else {
        alert("Usuário ou senha incorretos!");
    }
}

// Função de logout
function logout() {
    localStorage.removeItem("userLoggedIn"); // Remove a sessão do usuário
    window.location.href = "index.html"; // Redireciona para a tela de login
}
sessionStorage.setItem("userLoggedIn", "true"); // No login
sessionStorage.getItem("userLoggedIn"); // Para verificar
sessionStorage.removeItem("userLoggedIn"); // No logout
