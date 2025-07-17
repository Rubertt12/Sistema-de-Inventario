const express = require('express');
const nodemailer = require('nodemailer');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Simulando "banco de dados" em memória
const usuarios = {};

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'ruberttramires4@gmail.com',
    pass: 'hrrlahxsriwfukxi'
  }
});

app.post('/cadastro', async (req, res) => {
  const { nome, email, senha, perfil } = req.body;
  if (!nome || !email || !senha || !perfil) {
    return res.status(400).json({ mensagem: 'Todos os campos são obrigatórios!' });
  }

  const token = crypto.randomBytes(16).toString('hex');

  // Salva em "banco"
  usuarios[token] = { nome, email, perfil, confirmado: false };

  const link = `http://localhost:3000/confirmar?token=${token}`;

  await transporter.sendMail({
    from: '"Cadastro" <SEU_EMAIL@gmail.com>',
    to: email,
    subject: 'Confirme seu cadastro',
    html: `
      <h2>Olá, ${nome}!</h2>
      <p>Você se cadastrou como <strong>${perfil}</strong>.</p>
      <p>Para confirmar seu cadastro, clique no botão abaixo:</p>
      <a href="${link}" style="
        display: inline-block;
        padding: 12px 24px;
        background: #4f46e5;
        color: white;
        text-decoration: none;
        border-radius: 8px;
        font-weight: bold;
      ">Confirmar Cadastro</a>
      <p>Ou copie e cole este link no navegador: <br>${link}</p>
    `
  });

  res.json({ mensagem: 'Cadastro feito! Verifique seu e-mail para confirmar.' });
});

app.get('/confirmar', (req, res) => {
  const { token } = req.query;

  if (usuarios[token]) {
    usuarios[token].confirmado = true;
    res.redirect('/index.html'); // Redireciona para a tela inicial
  } else {
    res.status(400).send('<h1>Token inválido ou expirado!</h1>');
  }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));
