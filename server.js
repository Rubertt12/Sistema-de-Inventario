import express from "express";

// Legacy endpoint retired: account registration and email verification are
// handled by the official Supabase Auth flow. This server intentionally does
// not send mail or accept arbitrary recipient addresses.
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "8kb", strict: true }));

app.all("/cadastro", (_req, res) => {
  res.set("Cache-Control", "no-store");
  return res.status(410).json({
    msg: "Este endpoint foi desativado. Utilize o fluxo oficial de acesso da plataforma."
  });
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("Legacy registration endpoint disabled.");
});
