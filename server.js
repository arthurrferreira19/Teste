require("dotenv").config();
const { connectDB } = require("./src/config/db");
const app = require("./src/app");
const { ensureAdminSeed } = require("./src/services/seedService");

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log("Running on", PORT));

(async () => {
  try {
    await connectDB();
    await ensureAdminSeed();

    app.listen(PORT, () => {
      console.log(`[server] rodando na porta ${PORT}`);
    });
  } catch (err) {
    console.error("[boot] falha ao iniciar:", err);
    process.exit(1);
  }
})();
