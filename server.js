require('dotenv').config();
const express = require("express");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static("public"));
app.use(express.json());

let pendentes = [];

app.post("/api/cadastro", async (req, res) => {
  const { nome, email, senha } = req.body;

  const token = crypto.randomBytes(32).toString("hex");
  pendentes.push({ nome, email, senha, token });

  const link = `http://localhost:${PORT}/confirmacao.html?usuario=${encodeURIComponent(nome)}&token=${token}`;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL,
      pass: process.env.SENHA,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL,
    to: email,
    subject: "Confirmação de Cadastro",
    html: `<p>Olá, ${nome}! Clique para confirmar: <a href="${link}">Confirmar Cadastro</a></p>`,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json({ mensagem: "E-mail enviado! Verifique sua caixa de entrada." });
  } catch (error) {
    console.error("Erro ao enviar e-mail:", error);
    res.status(500).json({ mensagem: "Erro ao enviar e-mail." });
  }
});

app.get("/api/confirmar", (req, res) => {
  const { usuario, token } = req.query;
  const index = pendentes.findIndex(u => u.nome === usuario && u.token === token);

  if (index === -1) return res.status(400).json({ mensagem: "Token inválido ou expirado." });

  const user = pendentes[index];
  pendentes.splice(index, 1);

  // Gera JS para salvar no localStorage
  const script = `
    (function(){
      let usuarios = JSON.parse(localStorage.getItem('usuarios')) || [];
      usuarios.push({ nome: "${user.nome}", senha: "${user.senha}", perfil: "comum" });
      localStorage.setItem('usuarios', JSON.stringify(usuarios));
      sessionStorage.setItem("loggedUser", "${user.nome}");
    })();
  `;

  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Cadastro Confirmado</title></head>
    <body>
      <h2>Cadastro confirmado! Redirecionando...</h2>
      <script>${script}</script>
      <script>
        setTimeout(() => {
          window.location.href = "/dashboard.html";
        }, 2000);
      </script>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
