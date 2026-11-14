const { Pool } = require("pg");

// Un solo pool de conexiones para todo el backend. DATABASE_URL apunta a
// Postgres local en desarrollo, y a Neon en produccion (spec.md seccion 6):
// el motor, las tablas y el SQL no cambian, solo cambia la direccion.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

module.exports = pool;
