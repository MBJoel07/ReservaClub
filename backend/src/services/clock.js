// R5 de la spec: nadie en la logica de negocio llama a `new Date()`
// directamente. Todos piden la hora a este reloj, que en produccion
// devuelve la hora real y en los tests se puede fijar o adelantar.

class RealClock {
  now() {
    return new Date();
  }
}

class MockClock {
  constructor(fechaInicial = new Date()) {
    this._now = new Date(fechaInicial);
  }

  now() {
    return new Date(this._now);
  }

  // Fija el reloj a una fecha/hora exacta.
  set(fecha) {
    this._now = new Date(fecha);
  }

  // Adelanta el reloj sin esperar. ms en milisegundos.
  advance(ms) {
    this._now = new Date(this._now.getTime() + ms);
  }
}

// Instancia unica que usa la app. En los tests se reemplaza por un
// MockClock (ver tests/helpers.js) antes de requerir las rutas.
let instancia = new RealClock();

module.exports = {
  RealClock,
  MockClock,
  clock: {
    now: () => instancia.now(),
  },
  // Solo para tests: cambia que implementacion usa `clock.now()`.
  _setInstanciaParaTests(nuevaInstancia) {
    instancia = nuevaInstancia;
  },
};
