const express = require("express");
const pool = require("../db/pool");
const { requireAuth, requireRole } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

// GET /admin/deudas - solo admin (R4)
router.get("/deudas", requireAuth, requireRole("admin"), asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT r.id, r.usuario_id, u.email, r.cancha_id, r.fecha, r.hora_inicio, r.monto_deuda
     FROM reservas r
     JOIN usuarios u ON u.id = r.usuario_id
     WHERE r.deuda_generada = true
     ORDER BY r.cancelada_en DESC`
  );
  res.json(rows);
}));

module.exports = router;
