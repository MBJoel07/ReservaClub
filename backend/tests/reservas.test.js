const request = require("supertest");
const app = require("../src/app");
const pool = require("../src/db/pool");
const { resetDb, aplicarEsquema, crearCanchaDePrueba } = require("./helpers");
const { MockClock, _setInstanciaParaTests } = require("../src/services/clock");

let clock;

beforeAll(async () => {
  await aplicarEsquema();
});

beforeEach(async () => {
  await resetDb();
  // Arranca "hoy" en una fecha fija y controlable.
  clock = new MockClock("2026-11-16T12:00:00Z"); // lunes
  _setInstanciaParaTests(clock);
});

afterAll(async () => {
  await pool.end();
});

async function registrarYLoguear(email, rol = "socio") {
  await request(app).post("/auth/registro").send({ email, password: "1234", rol });
  const login = await request(app).post("/auth/login").send({ email, password: "1234" });
  return login.body.token;
}

describe("R1 - un turno, una reserva (concurrencia)", () => {
  test("la segunda reserva del mismo turno recibe 409", async () => {
    const cancha = await crearCanchaDePrueba();
    const tokenAna = await registrarYLoguear("ana@mail.com");
    const tokenBeto = await registrarYLoguear("beto@mail.com");

    const datos = { cancha_id: cancha.id, fecha: "2026-11-18", hora_inicio: "20:00" };

    const [resAna, resBeto] = await Promise.all([
      request(app).post("/reservas").set("Authorization", `Bearer ${tokenAna}`).send(datos),
      request(app).post("/reservas").set("Authorization", `Bearer ${tokenBeto}`).send(datos),
    ]);

    const codigos = [resAna.status, resBeto.status].sort();
    expect(codigos).toEqual([201, 409]);
  });

  test("cancelar libera el turno para que otro lo reserve", async () => {
    const cancha = await crearCanchaDePrueba();
    const tokenAna = await registrarYLoguear("ana@mail.com");
    const tokenBeto = await registrarYLoguear("beto@mail.com");
    const datos = { cancha_id: cancha.id, fecha: "2026-11-18", hora_inicio: "20:00" };

    const resAna = await request(app)
      .post("/reservas")
      .set("Authorization", `Bearer ${tokenAna}`)
      .send(datos)
      .expect(201);

    await request(app)
      .delete(`/reservas/${resAna.body.id}`)
      .set("Authorization", `Bearer ${tokenAna}`)
      .expect(200);

    await request(app)
      .post("/reservas")
      .set("Authorization", `Bearer ${tokenBeto}`)
      .send(datos)
      .expect(201);
  });
});

describe("R2 - precio al reservar", () => {
  test("la reserva se guarda con el precio calculado segun la spec", async () => {
    const cancha = await crearCanchaDePrueba({ precioBase: 10000 });
    const token = await registrarYLoguear("ana@mail.com", "socio");

    const res = await request(app)
      .post("/reservas")
      .set("Authorization", `Bearer ${token}`)
      .send({ cancha_id: cancha.id, fecha: "2026-11-18", hora_inicio: "20:00" })
      .expect(201);

    expect(Number(res.body.precio_cobrado)).toBe(10400);
  });
});

describe("R3 - cancelacion y penalidad (con Reloj mockeado)", () => {
  test("cancelar con 24hs o mas de anticipacion: sin penalidad", async () => {
    const cancha = await crearCanchaDePrueba({ precioBase: 10000 });
    const token = await registrarYLoguear("ana@mail.com");

    // "Hoy" el reloj esta en 2026-11-16 12:00. El turno es 2026-11-18 20:00:
    // faltan bastante mas de 24hs.
    const reserva = await request(app)
      .post("/reservas")
      .set("Authorization", `Bearer ${token}`)
      .send({ cancha_id: cancha.id, fecha: "2026-11-18", hora_inicio: "20:00" })
      .expect(201);

    const cancelacion = await request(app)
      .delete(`/reservas/${reserva.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(cancelacion.body.deuda_generada).toBe(false);
    expect(Number(cancelacion.body.monto_deuda)).toBe(0);
  });

  test("cancelar con menos de 24hs de anticipacion: deuda del 50%, sin esperar un dia real", async () => {
    const cancha = await crearCanchaDePrueba({ precioBase: 10000 });
    const token = await registrarYLoguear("ana@mail.com");

    const reserva = await request(app)
      .post("/reservas")
      .set("Authorization", `Bearer ${token}`)
      .send({ cancha_id: cancha.id, fecha: "2026-11-18", hora_inicio: "20:00" })
      .expect(201);

    // Adelantamos el reloj a menos de 24hs del turno, sin esperar de verdad.
    clock.set("2026-11-17T21:00:00Z"); // faltan 23hs para el turno

    const cancelacion = await request(app)
      .delete(`/reservas/${reserva.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(cancelacion.body.deuda_generada).toBe(true);
    expect(Number(cancelacion.body.monto_deuda)).toBe(5200); // 50% de 10400
  });

  test("no se puede cancelar un turno que ya paso", async () => {
    const cancha = await crearCanchaDePrueba({ precioBase: 10000 });
    const token = await registrarYLoguear("ana@mail.com");

    const reserva = await request(app)
      .post("/reservas")
      .set("Authorization", `Bearer ${token}`)
      .send({ cancha_id: cancha.id, fecha: "2026-11-18", hora_inicio: "20:00" })
      .expect(201);

    clock.set("2026-11-19T00:00:00Z"); // el turno ya paso

    await request(app)
      .delete(`/reservas/${reserva.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(409);
  });

  test("no se puede cancelar la reserva de otro usuario (403)", async () => {
    const cancha = await crearCanchaDePrueba();
    const tokenAna = await registrarYLoguear("ana@mail.com");
    const tokenBeto = await registrarYLoguear("beto@mail.com");

    const reserva = await request(app)
      .post("/reservas")
      .set("Authorization", `Bearer ${tokenAna}`)
      .send({ cancha_id: cancha.id, fecha: "2026-11-18", hora_inicio: "20:00" })
      .expect(201);

    await request(app)
      .delete(`/reservas/${reserva.body.id}`)
      .set("Authorization", `Bearer ${tokenBeto}`)
      .expect(403);
  });
});
