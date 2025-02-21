function login() {
    const usuario = document.getElementById("usuario").value;
    const senha = document.getElementById("senha").value;

    // Simulando um usuário fixo (troque isso para validar com um backend se necessário)
    if (usuario === "admin" && senha === "1234") {
        localStorage.setItem("userLoggedIn", "true"); // Marca como logado
        window.location.href = "dashboard.html"; // Redireciona para a Dashboard
    } else {
        alert("Usuário ou senha incorretos!");
    }
}
// Verifica se o usuário está logado ao carregar a Dashboard
document.addEventListener("DOMContentLoaded", function () {
    if (!localStorage.getItem("userLoggedIn")) {
        window.location.href = "index.html"; // Redireciona para login se não estiver autenticado
    }
});

// Função de logout
function logout() {
    localStorage.removeItem("userLoggedIn"); // Remove o login
    window.location.href = "index.html"; // Redireciona para login
}
