// Crea el admin inicial a partir de INITIAL_ADMIN_EMAIL / INITIAL_ADMIN_PASSWORD,
// pero solo si todavia no existe ningun admin (spec.md seccion 6).
// Uso: node src/db/seedAdmin.js
require("dotenv").config();
const bcrypt = require("bcryptjs");
const pool = require("./pool");

async function seedAdmin() {
  const email = process.env.INITIAL_ADMIN_EMAIL;
  const password = process.env.INITIAL_ADMIN_PASSWORD;

  if (!email || !password) {
    console.log("INITIAL_ADMIN_EMAIL / INITIAL_ADMIN_PASSWORD no estan definidas. Nada que hacer.");
    return;
  }

  const { rows } = await pool.query("SELECT id FROM usuarios WHERE rol = 'admin' LIMIT 1");
  if (rows.length > 0) {
    console.log("Ya existe un admin. No se crea otro.");
    return;
  }

  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    "INSERT INTO usuarios (email, password_hash, rol) VALUES ($1, $2, 'admin') ON CONFLICT (email) DO NOTHING",
    [email, hash]
  );
  console.log(`OK: admin inicial creado (${email}).`);
}

seedAdmin()
  .catch((err) => {
    console.error("Error al crear el admin inicial:", err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
