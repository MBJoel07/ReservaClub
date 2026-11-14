const express = require("express");
const pool = require("../db/pool");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

router.get("/", asyncHandler(async (_req, res) => {
  const { rows } = await pool.query("SELECT id, nombre, deporte, precio_base FROM canchas ORDER BY id");
  res.json(rows);
}));

module.exports = router;
