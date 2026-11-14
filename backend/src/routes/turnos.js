const express = require("express");
const jwt = require("jsonwebtoken");
const pool = require("../db/pool");
const { calcularPrecio } = require("../services/pricing");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

// Horarios de turno disponibles por dia (90 min cada uno).
const HORARIOS = [
  "08:00", "09:30", "11:00", "12:30",
  "14:00", "15:30", "17:00", "18:30",
  "20:00", "21:30",
];

// Auth opcional: si viene un token valido, usamos el rol real del usuario
// para el precio (R2). Si no, mostramos precio de socio como referencia
// (spec.md seccion 5).
function rolDeLaRequest(req) {
  const header = req.headers.authorization || "";
  const [esquema, token] = header.split(" ");
  if (esquema !== "Bearer" || !token) return "socio";
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return payload.rol === "no_socio" ? "no_socio" : "socio";
  } catch {
    return "socio";
  }
}

router.get("/", asyncHandler(async (req, res) => {
  const { cancha_id: canchaId, fecha } = req.query;

  if (!canchaId || !fecha) {
    return res.status(400).json({ error: "cancha_id y fecha son obligatorios." });
  }

  const { rows: canchas } = await pool.query("SELECT * FROM canchas WHERE id = $1", [canchaId]);
  const cancha = canchas[0];
  if (!cancha) {
    return res.status(404).json({ error: "Esa cancha no existe." });
  }

  const { rows: reservadas } = await pool.query(
    `SELECT hora_inicio FROM reservas
     WHERE cancha_id = $1 AND fecha = $2 AND estado = 'confirmada'`,
    [canchaId, fecha]
  );
  const horasTomadas = new Set(reservadas.map((r) => r.hora_inicio.slice(0, 5)));

  const rol = rolDeLaRequest(req);

  const turnos = HORARIOS.map((hora) => ({
    hora_inicio: hora,
    disponible: !horasTomadas.has(hora),
    precio: calcularPrecio(cancha.precio_base, fecha, hora, rol),
  }));

  res.json({ cancha_id: cancha.id, fecha, turnos });
}));

module.exports = router;
