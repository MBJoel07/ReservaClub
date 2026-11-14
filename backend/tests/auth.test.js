const request = require("supertest");
const app = require("../src/app");
const pool = require("../src/db/pool");
const { resetDb, aplicarEsquema } = require("./helpers");

beforeAll(async () => {
  await aplicarEsquema();
});

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await pool.end();
});

describe("R4 - autenticacion y autorizacion", () => {
  test("registro + login devuelve un token", async () => {
    await request(app)
      .post("/auth/registro")
      .send({ email: "ana@mail.com", password: "1234", rol: "socio" })
      .expect(201);

    const res = await request(app)
      .post("/auth/login")
      .send({ email: "ana@mail.com", password: "1234" })
      .expect(200);

    expect(res.body.token).toBeDefined();
  });

  test("login con password incorrecta -> 401", async () => {
    await request(app)
      .post("/auth/registro")
      .send({ email: "ana@mail.com", password: "1234", rol: "socio" });

    await request(app)
      .post("/auth/login")
      .send({ email: "ana@mail.com", password: "mal" })
      .expect(401);
  });

  test("ruta protegida sin token -> 401 (no sabemos quien sos)", async () => {
    await request(app).get("/reservas/mias").expect(401);
  });

  test("ruta de admin con token valido pero rol insuficiente -> 403 (sabemos quien sos, no podes pasar)", async () => {
    await request(app)
      .post("/auth/registro")
      .send({ email: "socio@mail.com", password: "1234", rol: "socio" });
    const login = await request(app)
      .post("/auth/login")
      .send({ email: "socio@mail.com", password: "1234" });

    await request(app)
      .get("/admin/deudas")
      .set("Authorization", `Bearer ${login.body.token}`)
      .expect(403);
  });

  test("ruta de admin con un admin de verdad -> 200", async () => {
    await pool.query(
      "INSERT INTO usuarios (email, password_hash, rol) VALUES ('admin@mail.com', $1, 'admin')",
      [require("bcryptjs").hashSync("1234", 10)]
    );
    const login = await request(app)
      .post("/auth/login")
      .send({ email: "admin@mail.com", password: "1234" });

    await request(app)
      .get("/admin/deudas")
      .set("Authorization", `Bearer ${login.body.token}`)
      .expect(200);
  });

  test("token con formato invalido -> 401, no 500", async () => {
    await request(app)
      .get("/reservas/mias")
      .set("Authorization", "Bearer esto-no-es-un-jwt")
      .expect(401);
  });
});
