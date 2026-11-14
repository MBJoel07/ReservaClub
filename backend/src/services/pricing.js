// R2 de la spec: calculo del precio de un turno.

const RECARGO_PICO = 0.04; // 4%
const RECARGO_NO_SOCIO = 0.3; // 30%
const HORA_PICO_DESDE = 19; // 19:00
const HORA_PICO_HASTA = 22; // 22:00 inclusive

function esHorarioPico(fecha, horaInicio) {
  // fecha: 'YYYY-MM-DD', horaInicio: 'HH:MM' o 'HH:MM:SS'
  const diaSemana = new Date(`${fecha}T00:00:00Z`).getUTCDay(); // 0=domingo..6=sabado
  const esDiaHabil = diaSemana >= 1 && diaSemana <= 5; // lunes a viernes
  const hora = parseInt(String(horaInicio).split(":")[0], 10);
  const enFranjaPico = hora >= HORA_PICO_DESDE && hora <= HORA_PICO_HASTA;
  return esDiaHabil && enFranjaPico;
}

/**
 * Calcula el precio de un turno segun R2.
 * @param {number} precioBase precio_base de la cancha
 * @param {string} fecha 'YYYY-MM-DD'
 * @param {string} horaInicio 'HH:MM'
 * @param {'socio'|'no_socio'} rolUsuario
 */
function calcularPrecio(precioBase, fecha, horaInicio, rolUsuario) {
  let precio = Number(precioBase);

  if (esHorarioPico(fecha, horaInicio)) {
    precio = precio * (1 + RECARGO_PICO);
  }

  if (rolUsuario === "no_socio") {
    precio = precio * (1 + RECARGO_NO_SOCIO);
  }

  // Redondeo a 2 decimales, evitando errores de punto flotante.
  return Math.round(precio * 100) / 100;
}

module.exports = { calcularPrecio, esHorarioPico, RECARGO_PICO, RECARGO_NO_SOCIO };
