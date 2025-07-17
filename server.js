const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));


// Banco fake na memória (use banco real se quiser persistência)
const usuarios = [];

function gerarToken() {
  return crypto.randomBytes(20).toString('hex');
}

// Rota de cadastro
app.post('/cadastro', (req, res) => {
  const { nome, email, senha, perfil } = req.body;

  if (usuarios.find(u => u.email === email)) {
    return res.status(400).json({ mensagem: 'E-mail já cadastrado.' });
  }

  const token = gerarToken();

  usuarios.push({ nome, email, senha, perfil, confirmado: false, token });

  const linkConfirmacao = `https://sistema-de-inventario-s5yu.onrender.com/api/confirmar?usuario=${encodeURIComponent(nome)}&token=${token}`;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS
    }
  });

  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: email,
    subject: 'Confirmação de Cadastro',
    html: `
      <h2>Olá, ${nome}!</h2>
      <p>Obrigado por se cadastrar. Clique no botão abaixo para confirmar seu cadastro:</p>
      <a href="${linkConfirmacao}" style="padding: 10px 20px; background: #4f46e5; color: white; text-decoration: none; border-radius: 6px;">Confirmar Cadastro</a>
    `
  };

  transporter.sendMail(mailOptions, (erro) => {
    if (erro) {
      console.error(erro);
      return res.status(500).json({ mensagem: 'Erro ao enviar e-mail.' });
    }

    res.json({ mensagem: 'Cadastro realizado! Verifique seu e-mail para confirmar.' });
  });
});

// Rota de confirmação
app.get('/api/confirmar', (req, res) => {
  const { usuario, token } = req.query;
  const user = usuarios.find(u => u.nome === usuario && u.token === token);

  if (!user) {
    return res.status(400).json({ error: 'Link inválido ou expirado.' });
  }

  if (user.confirmado) {
    return res.json({ message: 'Cadastro já confirmado.' });
  }

  user.confirmado = true;

  res.json({
    message: 'Cadastro confirmado com sucesso!',
    senhaGerada: user.senha // ou gere uma nova senha se preferir
  });
});

// Rota básica pra testar
app.get('/', (req, res) => {
  res.send('API rodando! 😎');
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
