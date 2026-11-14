# ReservaClub — Spec

> Este documento manda. Ningún cambio de regla de negocio entra por el código:
> entra por acá. Si el código y esta spec no coinciden, la spec tiene razón y
> el código está mal.

## 1. Contexto

ReservaClub es el sistema de reservas de canchas de un club (pádel y tenis).
Reemplaza la planilla y el grupo de WhatsApp: los socios reservan turno online,
el sistema aplica las reglas de precio y cancelación sin que nadie tenga que
estar mirando, y el club tiene un registro confiable de quién reservó qué y
quién quedó debiendo plata.

## 2. Actores

| Actor | Puede |
|---|---|
| Visitante (sin sesión) | Ver canchas y turnos disponibles. No puede reservar. |
| Socio | Todo lo del visitante + reservar y cancelar sus propios turnos, a precio de socio. |
| No socio | Igual que socio, pero paga el recargo de no-socio. |
| Admin | Todo lo anterior + ver el listado de deudas del club + dar de alta canchas. |

Un usuario autenticado es siempre `socio` o `no_socio` (se define al registrarse,
no cambia solo). `admin` es un rol aparte, no un socio con privilegios extra.

## 3. Entidades

- **Usuario**: id, email (único), password (hasheada), rol (`socio` | `no_socio` | `admin`), creado_en.
- **Cancha**: id, nombre (ej. "Pádel 1"), deporte (`padel` | `tenis`), precio_base (en pesos, por turno de 90 min).
- **Turno**: no es una tabla propia — es la combinación (cancha_id, fecha, hora_inicio). Se calcula al vuelo; lo que persiste es la Reserva.
- **Reserva**: id, usuario_id, cancha_id, fecha, hora_inicio, precio_cobrado, estado (`confirmada` | `cancelada`), creada_en, cancelada_en, deuda_generada (boolean), monto_deuda.

## 4. Reglas de negocio

### R1 — Un turno, una reserva (concurrencia)

Dos personas no pueden reservar el mismo (cancha_id, fecha, hora_inicio) a la vez.

- La tabla `reservas` tiene un índice único sobre (cancha_id, fecha, hora_inicio)
  para las reservas con estado `confirmada`.
- Si dos requests llegan al mismo tiempo para el mismo turno, la base de datos
  resuelve cuál llega primero: esa reserva se crea con `201`. La segunda
  recibe `409 Conflict` con un mensaje claro ("ese turno ya fue reservado").
- Una reserva cancelada libera el turno: después de cancelar, otro usuario
  puede reservar ese mismo (cancha, fecha, hora) sin problema.

**No** se resuelve con un `SELECT` previo seguido de un `INSERT` ("fijarse si
está libre y después reservar"): eso tiene una ventana de carrera. Se resuelve
dejando que la base de datos rechace el `INSERT` duplicado y traduciendo ese
rechazo a 409.

### R2 — Precio del turno

El precio de un turno se calcula así, en este orden:

1. **Precio base** de la cancha (ej. Pádel = $10.000, Tenis = $12.000).
2. **Recargo de horario pico**: si el turno cae en horario pico (ver tabla),
   se suma un 4% sobre el precio base.
3. **Recargo de no-socio**: si quien reserva es `no_socio`, se suma un 30%
   adicional sobre el precio ya calculado en el paso 2 (no sobre el precio base).

Horario pico = de lunes a viernes, de 19:00 a 22:00 inclusive (hora de inicio
del turno).

**Ejemplo de la spec** (caso de referencia, viene de la Clase 10): Pádel,
miércoles 20:00, socio → $10.000 base + 4% pico = **$10.400**.

El precio se calcula en el momento de reservar y se guarda en la reserva
(`precio_cobrado`): si el club cambia el precio base de una cancha después,
las reservas ya hechas no cambian de precio retroactivamente.

### R3 — Cancelación y penalidad

Un usuario puede cancelar su propia reserva en cualquier momento antes de que
empiece el turno.

- Si cancela con **24 horas o más** de anticipación respecto a la hora de
  inicio del turno: se cancela sin penalidad. `deuda_generada = false`.
- Si cancela con **menos de 24 horas** de anticipación: la reserva se cancela
  igual (libera el turno), pero se genera una deuda del **50% del precio
  cobrado** (`deuda_generada = true`, `monto_deuda = precio_cobrado * 0.5`).
  Esa deuda queda registrada en la cuenta del usuario; el sistema no cobra
  nada automáticamente, solo la registra (eso es un sistema de pagos aparte,
  fuera de este proyecto).
- No se puede cancelar una reserva que ya pasó (hora_inicio en el pasado) ni
  una que ya está cancelada.

**Cómo se prueba sin esperar un día real**: el sistema nunca lee la hora
llamando directamente a `new Date()` desde la lógica de negocio. Hay un
`ClockService` (ver R5) del que se pide la hora actual, y en los tests ese
reloj se puede fijar a cualquier fecha/hora sin esperar.

### R4 — Autenticación y autorización

- Login es con email + password. Si son correctos, se devuelve un JWT.
- Rutas que requieren sesión (reservar, cancelar, ver "mis reservas") exigen
  el token en el header `Authorization: Bearer <token>`.
- **401** = no sabemos quién sos: no mandaste token, el token es inválido, o
  expiró.
- **403** = sabemos quién sos, pero no podés pasar: mandaste un token válido
  pero tu rol no alcanza para esa ruta (ej. un socio intentando entrar a
  `/admin/deudas`).
- Nunca se usa 404 para ocultar una ruta que existe pero no es para ese rol:
  eso confunde "no existe" con "no tenés permiso". Se usa 403.

### R5 — Reloj propio

Toda la lógica de negocio que depende de "qué hora es ahora" (R3, horario
pico en R2) pide la hora a un `ClockService`, nunca a `new Date()` directamente.

- En producción, `ClockService.now()` devuelve la hora real.
- En los tests, se usa una implementación que arranca en una fecha fija y se
  puede adelantar (`clock.advance(ms)`) o fijar a un valor exacto
  (`clock.set(fecha)`), para poder probar "cancelar 23 horas antes" sin
  esperar 23 horas de verdad.

### R6 — CORS

El backend sólo acepta pedidos del origen configurado en la variable de
entorno `FRONTEND_URL`. Cualquier otro origen que intente llamar a la API
desde un navegador es bloqueado por el navegador mismo (el backend nunca
devuelve los headers de CORS para ese origen).

## 5. Endpoints

| Método y ruta | Auth | Descripción |
|---|---|---|
| `POST /auth/registro` | — | Crea un usuario. Body: `email, password, rol` (`socio`\|`no_socio`). |
| `POST /auth/login` | — | Body: `email, password`. Devuelve `{ token }`. |
| `GET /canchas` | — | Lista de canchas. |
| `GET /turnos?cancha_id&fecha` | — | Turnos de ese día para esa cancha: hora, disponible sí/no, y precio **si hay sesión** (si no hay sesión, precio de socio como referencia). |
| `POST /reservas` | Sesión | Body: `cancha_id, fecha, hora_inicio`. `201` si se pudo reservar, `409` si el turno ya estaba tomado. |
| `GET /reservas/mias` | Sesión | Las reservas del usuario logueado. |
| `DELETE /reservas/:id` | Sesión (dueño o admin) | Cancela. Aplica R3. `403` si no sos el dueño ni admin. `404` si no existe. `409` si ya estaba cancelada o ya pasó. |
| `GET /admin/deudas` | Admin | Lista de reservas con `deuda_generada = true`. `403` si no sos admin. |
| `GET /health` | — | Para que Render sepa que el proceso está vivo. |

## 6. Infraestructura

| Parte | Local | Producción |
|---|---|---|
| Frontend | `localhost:5173` (Vite) | Netlify (archivos estáticos) |
| Backend | `localhost:3000` (Express) | Render (proceso Node siempre corriendo) |
| Base de datos | PostgreSQL local | Neon (PostgreSQL en la nube) |

Variables de entorno:

| Dónde | Variable | Para qué |
|---|---|---|
| Backend | `DATABASE_URL` | Conexión a PostgreSQL (local o Neon). |
| Backend | `JWT_SECRET` | Firma de los tokens. |
| Backend | `FRONTEND_URL` | Origen permitido por CORS (R6). |
| Backend | `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD` | Admin inicial, se crea solo si no existe ningún admin. |
| Backend | `PORT` | Puerto del servidor (Render lo inyecta solo). |
| Frontend | `VITE_API_URL` | Dirección del backend. |

Los secretos nunca se commitean: viven en `.env` local (gitignoreado) y se
cargan a mano en el panel de Render/Netlify en producción.

## 7. Fuera de alcance (a propósito)

- Pagos online (la deuda se registra, no se cobra).
- Notificaciones por email/WhatsApp.
- Recurrencia de turnos (reservar "todos los miércoles").

## 8. Historial de cambios de la spec

Ejemplo de cómo entra un cambio de negocio (ciclo de la Clase 10: analista
escribe la spec → arquitecto arma el plan → tester escribe el test rojo →
dev lo pone verde → revisor aprueba):

- **v1.0** — Spec inicial: R1 a R6 como están arriba.
