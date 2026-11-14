// Variables de entorno para los tests, antes de que cualquier modulo lea
// process.env (pool.js, jwt, etc.). Se corre una sola vez por archivo de
// test, antes de los requires del archivo.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://postgres:postgres@127.0.0.1:5432/reservaclub_test";
process.env.JWT_SECRET = "secreto-de-test";
process.env.FRONTEND_URL = "http://localhost:5173";
