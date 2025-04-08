function toggleMenu() {
    document.querySelector('.nav-links').classList.toggle('active');
}
function toggleUserMenu() {
    let menu = document.getElementById("userDropdown");
    menu.style.display = menu.style.display === "block" ? "none" : "block";
}



// Fechar menu ao clicar fora
document.addEventListener("click", function(event) {
    let menu = document.getElementById("userDropdown");
    let avatar = document.querySelector(".user-avatar");
    if (menu.style.display === "block" && !menu.contains(event.target) && !avatar.contains(event.target)) {
        menu.style.display = "none";
    }
});



function logout(button) {
    // Se já tiver animado, evita repetir
    if (button.classList.contains('animate')) return;
  
    // Envolve o emoji da porta num <span>
    if (!button.querySelector('span')) {
      const parts = button.innerHTML.split('🚪');
      button.innerHTML = `${parts[0]}<span>🚪</span>`;
    }
  
    const door = button.querySelector('span');
    button.classList.add('animate');
  
    // Espera a animação e então desloga
    setTimeout(() => {
      console.log("Tchau, piazito! 👋");
      sessionStorage.removeItem("loggedUser");
      window.location.href = "index.html"; // Redireciona para a tela de login
    }, 700);
  }
  

// Exibir nome do usuário no menu
document.addEventListener("DOMContentLoaded", function() {
    let user = sessionStorage.getItem("loggedUser") || "Usuário";
    document.getElementById("userName").textContent = user;
});

// Alternar Menu de Usuário
function toggleUserMenu() {
    const dropdown = document.getElementById("userDropdown");
    dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
}

// Fechar menu ao clicar fora
document.addEventListener("click", function (event) {
    const userMenu = document.querySelector(".user-menu");
    const dropdown = document.getElementById("userDropdown");
    if (!userMenu.contains(event.target)) {
        dropdown.style.display = "none";
    }
});

// Abrir Modal de Configurações
function openConfigModal() {
    document.getElementById("configModal").style.display = "block";
}

// Fechar Modal de Configurações
function closeConfigModal() {
    document.getElementById("configModal").style.display = "none";
}

// Alterar Foto de Perfil
function changeProfilePicture(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById("profilePic").src = e.target.result;
            document.getElementById("userAvatar").src = e.target.result; // Atualiza no menu também
        };
        reader.readAsDataURL(file);
    }
}


    // Função para alternar a visibilidade do menu de configurações
function toggleUserMenu() {
    const userDropdown = document.getElementById('userDropdown');
    userDropdown.style.display = userDropdown.style.display === 'none' ? 'block' : 'none';
}

// Função para abrir o modal de configurações
function openConfigModal() {
    const modal = document.getElementById('configModal');
    modal.style.display = 'block';
    toggleUserMenu(); // Fecha o menu dropdown após abrir o modal
}

// Função para fechar o modal de configurações
function closeConfigModal() {
    const modal = document.getElementById('configModal');
    modal.style.display = 'none';
}


