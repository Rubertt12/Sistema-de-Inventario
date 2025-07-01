const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Serve arquivos estáticos (index.html, dashboard.html, css, js, etc)
app.use(express.static(path.join(__dirname, 'public')));

app.use(bodyParser.json());

app.use(session({
  secret: 'segredo-super-secreto', // Mude para algo seguro
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // se for https, pode colocar true
}));

const usuariosFile = path.join(__dirname, 'usuarios.json');

// Lê usuários do arquivo JSON ou cria padrão se não existir
function lerUsuarios() {
  if (!fs.existsSync(usuariosFile)) {
    const admin = [{
      nome: "admin",
      senha: "L7QKP09r09d$",
      perfil: "admin"
    }];
    fs.writeFileSync(usuariosFile, JSON.stringify(admin, null, 2));
    return admin;
  }
  const data = fs.readFileSync(usuariosFile);
  return JSON.parse(data);
}

// Salva usuários no arquivo JSON
function salvarUsuarios(usuarios) {
  fs.writeFileSync(usuariosFile, JSON.stringify(usuarios, null, 2));
}

// Rota para login
app.post('/login', (req, res) => {
  const { nome, senha } = req.body;
  const usuarios = lerUsuarios();
  const user = usuarios.find(u => u.nome === nome && u.senha === senha);
  if (!user) {
    return res.status(401).json({ error: 'Usuário ou senha inválidos' });
  }
  req.session.user = user;
  res.json({ message: 'Login realizado com sucesso', user: { nome: user.nome, perfil: user.perfil } });
});

// Rota protegida do dashboard
app.get('/dashboard', (req, res) => {
  if (!req.session.user) {
    return res.status(401).send('Não autorizado. Faça login.');
  }
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Rota para logout
app.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ message: 'Logout efetuado' });
});

// Rota para checar se está logado (útil para frontend)
app.get('/me', (req, res) => {
  if (req.session.user) {
    return res.json({ user: req.session.user });
  }
  res.status(401).json({ error: 'Não autenticado' });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
