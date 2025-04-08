function toggleUserMenu() {
    const dropdown = document.getElementById("userDropdown");
    dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
}

function logout(button) {
    if (button.classList.contains('animate')) return;

    if (!button.querySelector('span')) {
        const parts = button.innerHTML.split('🚪');
        button.innerHTML = `${parts[0]}<span>🚪</span>`;
    }

    const door = button.querySelector('span');
    button.classList.add('animate');

    setTimeout(() => {
        console.log("Tchau, piazito! 👋");
        sessionStorage.removeItem("loggedUser");
        window.location.href = "index.html";
    }, 700);
}

function mostrarNomeUsuario() {
    const user = sessionStorage.getItem("loggedUser") || "Usuário";
    document.getElementById("userName").textContent = user;
}

// Fecha o menu ao clicar fora
document.addEventListener("click", function (event) {
    const userMenu = document.querySelector(".user-menu");
    const dropdown = document.getElementById("userDropdown");
    if (!userMenu.contains(event.target)) {
        dropdown.style.display = "none";
    }
});
