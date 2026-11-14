const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db/pool");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

router.post("/registro", asyncHandler(async (req, res) => {
  const { email, password, rol } = req.body || {};

  if (!email || !password || !["socio", "no_socio"].includes(rol)) {
    return res.status(400).json({
      error: "Faltan datos: email, password y rol ('socio' o 'no_socio') son obligatorios.",
    });
  }

  const hash = await bcrypt.hash(password, 10);

  try {
    const { rows } = await pool.query(
      "INSERT INTO usuarios (email, password_hash, rol) VALUES ($1, $2, $3) RETURNING id, email, rol",
      [email, hash, rol]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Ese email ya esta registrado." });
    }
    throw err;
  }
}));

router.post("/login", asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Faltan email o password." });
  }

  const { rows } = await pool.query("SELECT * FROM usuarios WHERE email = $1", [email]);
  const usuario = rows[0];

  if (!usuario) {
    return res.status(401).json({ error: "Email o password incorrectos." });
  }

  const passwordOk = await bcrypt.compare(password, usuario.password_hash);
  if (!passwordOk) {
    return res.status(401).json({ error: "Email o password incorrectos." });
  }

  const token = jwt.sign(
    { id: usuario.id, email: usuario.email, rol: usuario.rol },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );

  return res.json({ token });
}));

module.exports = router;
