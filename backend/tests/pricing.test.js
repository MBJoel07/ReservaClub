const { calcularPrecio } = require("../src/services/pricing");

describe("R2 - precio del turno", () => {
  test("caso de referencia de la spec: Padel, miercoles 20:00, socio -> $10.400", () => {
    // 2026-11-18 es un miercoles.
    const precio = calcularPrecio(10000, "2026-11-18", "20:00", "socio");
    expect(precio).toBe(10400);
  });

  test("fuera de horario pico, socio paga el precio base sin recargo", () => {
    const precio = calcularPrecio(10000, "2026-11-18", "10:00", "socio");
    expect(precio).toBe(10000);
  });

  test("sabado a la noche no es horario pico (solo cuenta lunes a viernes)", () => {
    // 2026-11-21 es sabado.
    const precio = calcularPrecio(10000, "2026-11-21", "20:00", "socio");
    expect(precio).toBe(10000);
  });

  test("no socio paga el recargo de no-socio sobre el precio ya con pico", () => {
    // 10000 * 1.04 (pico) * 1.30 (no socio) = 13520
    const precio = calcularPrecio(10000, "2026-11-18", "20:00", "no_socio");
    expect(precio).toBe(13520);
  });

  test("no socio fuera de horario pico paga solo el recargo de no-socio", () => {
    const precio = calcularPrecio(10000, "2026-11-18", "10:00", "no_socio");
    expect(precio).toBe(13000);
  });
});
