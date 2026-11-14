-- ReservaClub - esquema (spec.md seccion 3)

CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('socio', 'no_socio', 'admin')),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS canchas (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  deporte TEXT NOT NULL CHECK (deporte IN ('padel', 'tenis')),
  precio_base NUMERIC(10, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS reservas (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  cancha_id INTEGER NOT NULL REFERENCES canchas(id),
  fecha DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  precio_cobrado NUMERIC(10, 2) NOT NULL,
  estado TEXT NOT NULL CHECK (estado IN ('confirmada', 'cancelada')) DEFAULT 'confirmada',
  creada_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelada_en TIMESTAMPTZ,
  deuda_generada BOOLEAN NOT NULL DEFAULT false,
  monto_deuda NUMERIC(10, 2) NOT NULL DEFAULT 0
);

-- R1: un turno, una reserva. El indice parcial solo mira las confirmadas,
-- asi una reserva cancelada libera el turno para que otro lo tome.
CREATE UNIQUE INDEX IF NOT EXISTS turno_unico_confirmado
  ON reservas (cancha_id, fecha, hora_inicio)
  WHERE estado = 'confirmada';
