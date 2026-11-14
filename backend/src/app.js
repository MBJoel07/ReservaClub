require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const canchasRoutes = require("./routes/canchas");
const turnosRoutes = require("./routes/turnos");
const reservasRoutes = require("./routes/reservas");
const adminRoutes = require("./routes/admin");

const app = express();

app.use(express.json());

// R6: CORS restringido al origen del frontend.
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
  })
);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth", authRoutes);
app.use("/canchas", canchasRoutes);
app.use("/turnos", turnosRoutes);
app.use("/reservas", reservasRoutes);
app.use("/admin", adminRoutes);

// Manejador de errores centralizado: si algo tira una excepcion no
// contemplada, no se cae el proceso, se responde 500.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor." });
});

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`ReservaClub backend escuchando en el puerto ${PORT}`));
}
