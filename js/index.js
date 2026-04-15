document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('formLogin');
    const userField = document.getElementById('loginUsuario');
    const passField = document.getElementById('loginSenha');
    const rememberMe = document.getElementById('rememberMe');
    const loginMsg = document.getElementById('loginMsg');

    // 1. Recuperar dados salvos (Lembrar-me)
    if (localStorage.getItem('rememberedUser')) {
        userField.value = localStorage.getItem('rememberedUser');
        passField.value = localStorage.getItem('rememberedPass');
        rememberMe.checked = true;
    }

    // 2. Evento de Login
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const nome = userField.value.trim();
        const senha = passField.value;
        const usuarios = JSON.parse(localStorage.getItem('usuarios')) || [];

        // Procura o usuário (Case Insensitive para o nome)
        const user = usuarios.find(u => 
            u.nome.toLowerCase() === nome.toLowerCase() && u.senha === senha
        );

        if (user) {
            // Lógica do Checkbox "Lembrar-me"
            if (rememberMe.checked) {
                localStorage.setItem('rememberedUser', nome);
                localStorage.setItem('rememberedPass', senha);
            } else {
                localStorage.removeItem('rememberedUser');
                localStorage.removeItem('rememberedPass');
            }

            // Salva o usuário na sessão atual
            localStorage.setItem('usuarioLogado', JSON.stringify(user));

            // --- INICIAR CARREGAMENTO DE 50 SEGUNDOS ---
            
            // Esconde o card e mostra o overlay
            document.getElementById('loginCard').style.display = 'none';
            document.getElementById('loadingOverlay').style.display = 'flex';

            const bar = document.getElementById('progressBar');
            const txt = document.getElementById('loadingText');

            // Definição dos passos (texto e percentagem)
            const steps = [
                { p: 10, t: "Autenticando credenciais..." },
                { p: 25, t: "Estabelecendo conexão segura..." },
                { p: 45, t: "Carregando módulos de segurança..." },
                { p: 65, t: "Sincronizando base de dados..." },
                { p: 85, t: "Preparando seu painel..." },
                { p: 100, t: "Concluído! A entrar..." }
            ];

            const tempoTotal = 15000; // 20 segundos
            const intervalo = tempoTotal / steps.length;

            // Distribui as mensagens ao longo dos 50s
            steps.forEach((step, index) => {
                setTimeout(() => {
                    if (bar) bar.style.width = step.p + "%";
                    if (txt) txt.textContent = step.t;
                }, index * intervalo);
            });

            // Redirecionamento final após 50 segundos
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, tempoTotal);

        } else {
            // Erro de login
            loginMsg.textContent = "Acesso negado. Verifique os seus dados.";
            loginMsg.style.color = "red";
            
            // Limpa a mensagem após 3 segundos
            setTimeout(() => {
                loginMsg.textContent = "";
            }, 3000);
        }
    });
});