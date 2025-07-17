// ui.js

// Alterna o menu do usuário
export function toggleUserMenu(event) {
  event.stopPropagation();
  const dropdown = document.getElementById("userDropdown");
  dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
}

// Fecha o menu ao clicar fora
export function configurarFechamentoMenu() {
  document.addEventListener("click", function(event) {
    const userMenu = document.querySelector(".user-menu");
    const dropdown = document.getElementById("userDropdown");
    if (!userMenu.contains(event.target)) {
      dropdown.style.display = "none";
    }
  });
}
