const express = require("express");
const pool = require("../db/pool");
const { requireAuth } = require("../middleware/auth");
const { calcularPrecio } = require("../services/pricing");
const { clock } = require("../services/clock");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

const VEINTICUATRO_HORAS_MS = 24 * 60 * 60 * 1000;

// POST /reservas - R1 (concurrencia) + R2 (precio)
router.post("/", requireAuth, asyncHandler(async (req, res) => {
  const { cancha_id: canchaId, fecha, hora_inicio: horaInicio } = req.body || {};

  if (!canchaId || !fecha || !horaInicio) {
    return res.status(400).json({ error: "cancha_id, fecha y hora_inicio son obligatorios." });
  }

  const { rows: canchas } = await pool.query("SELECT * FROM canchas WHERE id = $1", [canchaId]);
  const cancha = canchas[0];
  if (!cancha) {
    return res.status(404).json({ error: "Esa cancha no existe." });
  }

  const precio = calcularPrecio(cancha.precio_base, fecha, horaInicio, req.usuario.rol);

  try {
    // R1: el indice unico `turno_unico_confirmado` es quien decide. No se
    // hace un SELECT previo para "ver si esta libre": eso tiene ventana de
    // carrera. Dejamos que la base rechace el INSERT duplicado.
    const { rows } = await pool.query(
      `INSERT INTO reservas (usuario_id, cancha_id, fecha, hora_inicio, precio_cobrado)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, cancha_id, fecha, hora_inicio, precio_cobrado, estado`,
      [req.usuario.id, canchaId, fecha, horaInicio, precio]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Ese turno ya fue reservado por otra persona." });
    }
    throw err;
  }
}));

// GET /reservas/mias
router.get("/mias", requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, cancha_id, fecha, hora_inicio, precio_cobrado, estado, deuda_generada, monto_deuda
     FROM reservas WHERE usuario_id = $1 ORDER BY fecha DESC, hora_inicio DESC`,
    [req.usuario.id]
  );
  res.json(rows);
}));

// DELETE /reservas/:id - R3 (cancelacion y penalidad), via el Reloj (R5)
router.delete("/:id", requireAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { rows } = await pool.query("SELECT * FROM reservas WHERE id = $1", [id]);
  const reserva = rows[0];

  if (!reserva) {
    return res.status(404).json({ error: "Esa reserva no existe." });
  }

  const esDueno = reserva.usuario_id === req.usuario.id;
  const esAdmin = req.usuario.rol === "admin";
  if (!esDueno && !esAdmin) {
    return res.status(403).json({ error: "No podes cancelar una reserva que no es tuya." });
  }

  if (reserva.estado === "cancelada") {
    return res.status(409).json({ error: "Esa reserva ya estaba cancelada." });
  }

  const inicioTurno = new Date(`${reserva.fecha.toISOString().slice(0, 10)}T${reserva.hora_inicio}`);
  const ahora = clock.now();

  if (inicioTurno.getTime() <= ahora.getTime()) {
    return res.status(409).json({ error: "No se puede cancelar un turno que ya paso." });
  }

  const faltanMs = inicioTurno.getTime() - ahora.getTime();
  const conPenalidad = faltanMs < VEINTICUATRO_HORAS_MS;
  const montoDeuda = conPenalidad ? Math.round(Number(reserva.precio_cobrado) * 0.5 * 100) / 100 : 0;

  const { rows: actualizadas } = await pool.query(
    `UPDATE reservas
     SET estado = 'cancelada', cancelada_en = $2, deuda_generada = $3, monto_deuda = $4
     WHERE id = $1
     RETURNING id, estado, deuda_generada, monto_deuda`,
    [id, ahora.toISOString(), conPenalidad, montoDeuda]
  );

  res.json(actualizadas[0]);
}));

module.exports = router;
