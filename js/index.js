function toggleForms() {
    document.getElementById('loginContainer').style.display = 
        document.getElementById('loginContainer').style.display === 'none' ? 'block' : 'none';
    document.getElementById('registerContainer').style.display = 
        document.getElementById('registerContainer').style.display === 'none' ? 'block' : 'none';
}

function register() {
    let user = document.getElementById('registerUser').value;
    let pass = document.getElementById('registerPass').value;
    if (user && pass) {
        localStorage.setItem(user, pass);
        alert('Cadastro realizado!');
        toggleForms();
    } else {
        alert('Preencha todos os campos!');
    }
}

function login() {
    let user = document.getElementById('loginUser').value;
    let pass = document.getElementById('loginPass').value;
    if (localStorage.getItem(user) === pass) {
        alert('Login bem-sucedido!');
        sessionStorage.setItem('loggedUser', user);
        window.location.href = 'dashboard.html';
    } else {
        alert('Usuário ou senha incorretos!');
    }
}