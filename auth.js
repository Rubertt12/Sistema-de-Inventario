document.addEventListener("DOMContentLoaded", function () {
    function login() {
        let username = document.getElementById("loginUser").value;
        let password = document.getElementById("loginPass").value;

        // Recupera credenciais armazenadas
        let storedUser = localStorage.getItem("username");
        let storedPass = localStorage.getItem("password");

        if (username === storedUser && password === storedPass) {
            localStorage.setItem("loggedIn", "true"); // Define que o usuário está logado
            window.location.href = "dashboard.html"; // Redireciona para a dashboard
        } else {
            alert("Usuário ou senha incorretos!");
        }
    }

    function toggleForms() {
        document.getElementById("loginContainer").style.display = "none";
        document.getElementById("registerContainer").style.display = "block";
    }

    function register() {
        let newUser = document.getElementById("registerUser").value;
        let newPass = document.getElementById("registerPass").value;

        if (newUser && newPass) {
            localStorage.setItem("username", newUser);
            localStorage.setItem("password", newPass);
            alert("Cadastro realizado! Agora faça login.");
            document.getElementById("loginContainer").style.display = "block";
            document.getElementById("registerContainer").style.display = "none";
        } else {
            alert("Preencha todos os campos!");
        }
    }

    // Expondo funções no escopo global
    window.login = login;
    window.toggleForms = toggleForms;
    window.register = register;
});
