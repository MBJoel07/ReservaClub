const fs = require("fs");
const path = require("path");
const pool = require("../src/db/pool");

async function resetDb() {
  await pool.query("TRUNCATE TABLE reservas, usuarios, canchas RESTART IDENTITY CASCADE");
}

async function aplicarEsquema() {
  const sql = fs.readFileSync(path.join(__dirname, "../src/db/schema.sql"), "utf8");
  await pool.query(sql);
}

async function crearCanchaDePrueba({ nombre = "Padel 1", deporte = "padel", precioBase = 10000 } = {}) {
  const { rows } = await pool.query(
    "INSERT INTO canchas (nombre, deporte, precio_base) VALUES ($1, $2, $3) RETURNING *",
    [nombre, deporte, precioBase]
  );
  return rows[0];
}

module.exports = { resetDb, aplicarEsquema, crearCanchaDePrueba };
