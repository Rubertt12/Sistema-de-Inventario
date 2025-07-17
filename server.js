import express from "express";
import nodemailer from "nodemailer";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

app.post("/cadastro", async (req, res) => {
  const { nome, email } = req.body;

  if (!nome || !email) return res.status(400).json({ msg: "Campos obrigatórios" });

  try {
    const linkConfirmacao = `https://sistema-de-inventario-pearl.vercel.app/index.html?email=${encodeURIComponent(email)}`;

    await transporter.sendMail({
      from: `"Sistema de Cadastro" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "Confirmação de Cadastro",
      html: `
        <h2>Olá, ${nome}!</h2>
        <p>Obrigado por se cadastrar. Para confirmar seu cadastro, clique no botão abaixo:</p>
        <a href="${linkConfirmacao}" style="
          display:inline-block;
          padding: 10px 20px;
          background-color: #4CAF50;
          color: white;
          text-decoration: none;
          border-radius: 5px;
        ">Confirmar Cadastro</a>
      `,
    });

    res.status(200).json({ msg: "Email enviado com sucesso!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Erro ao enviar email" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
