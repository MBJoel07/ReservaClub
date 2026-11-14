# ReservaClub

Proyecto Final — Stage 2, Generación T (Mauro Beltran).

Sistema de reservas de canchas de un club (pádel y tenis), construido
siguiendo **spec-driven development**: toda regla de negocio vive primero en
[`spec.md`](./spec.md), y el código y los tests se escriben a partir de esa
spec, no al revés. Si en algún momento el código hace algo distinto de lo que
dice la spec, la spec tiene razón.

## Qué hay en este repo

```
reservaclub/
  spec.md              <- la spec. Leer esto primero.
  backend/             <- API REST (Node + Express + PostgreSQL)
  frontend/             <- cliente web (React + Vite)
```

## Cómo correrlo en tu máquina

### 1. Base de datos

Necesitás PostgreSQL corriendo (local o en Docker). Creá una base vacía,
por ejemplo `reservaclub`.

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env     # completar DATABASE_URL, JWT_SECRET, etc.
npm run migrate          # crea las tablas
npm run seed:admin       # crea el admin inicial (INITIAL_ADMIN_EMAIL/PASSWORD del .env)
npm run dev               # http://localhost:3000
```

Para correr los tests (necesitan una base separada, por ejemplo
`reservaclub_test`, con el mismo usuario/contraseña):

```bash
npm test
```

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env     # VITE_API_URL=http://localhost:3000
npm run dev                # http://localhost:5173
```

Con el backend y el frontend corriendo, entrá a `http://localhost:5173`,
registrate como socio o no socio, y reservá un turno. Si querés probar el
panel de admin, iniciá sesión con el `INITIAL_ADMIN_EMAIL` /
`INITIAL_ADMIN_PASSWORD` que pusiste en el `.env` del backend.

## Cómo está desplegado en producción (según la spec, sección 6)

| Parte | Servicio | Por qué |
|---|---|---|
| Frontend | **Netlify** | Es solo HTML/CSS/JS estático después de `npm run build`; Netlify lo distribuye, no necesita un proceso corriendo. |
| Backend | **Render** | Necesita un proceso Node siempre vivo para atender requests (aplica las reglas de negocio). |
| Base de datos | **Neon** | PostgreSQL en la nube. Mismo motor, mismas tablas, mismo SQL que en local — solo cambia la cadena de conexión. |

Pasos para desplegar:

1. **Neon**: crear un proyecto, copiar la `DATABASE_URL` que da Neon.
2. **Render**: crear un *Web Service* apuntando a la carpeta `backend/`,
   build command `npm install`, start command `npm start`. Cargar las
   variables de entorno a mano en el panel de Render: `DATABASE_URL` (la de
   Neon), `JWT_SECRET`, `FRONTEND_URL` (la URL que te va a dar Netlify),
   `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD`. Después de que el
   servicio esté arriba, correr una vez `npm run migrate` y
   `npm run seed:admin` (Render tiene una consola para esto, o se puede
   correr como *Job* suelto).
3. **Netlify**: crear un sitio apuntando a la carpeta `frontend/`, build
   command `npm run build`, publish directory `dist`. Variable de entorno
   `VITE_API_URL` = la URL que te dio Render.

Los secretos (`JWT_SECRET`, `DATABASE_URL`, `INITIAL_ADMIN_PASSWORD`) **nunca**
se commitean al repo: se cargan a mano en los paneles de Render/Netlify, tal
como dice la Clase 9 del módulo ("el código puede ser público en GitHub, los
secretos nunca").

## Cómo subir esto a tu propio repositorio

Este proyecto no incluye un repo de Git inicializado (para no pisar
configuración de git que ya tengas). Para entregarlo:

```bash
cd reservaclub
git init
git add .
git commit -m "ReservaClub - proyecto final Stage 2"
# crear un repo vacío en GitHub (desde la web) y despues:
git remote add origin <URL-de-tu-repo>
git push -u origin main
```

El link de ese repo es lo que pide la entrega "ENTREGA FINAL PROYECTO" en el
campus.

## Qué regla de la spec cubre cada test

Ver `backend/tests/`:

- `pricing.test.js` → R2 (precio, con y sin recargo de horario pico y de no-socio).
- `auth.test.js` → R4 (401 vs 403, login, registro).
- `reservas.test.js` → R1 (concurrencia, 409), R2 (precio al reservar) y R3
  (cancelación y penalidad del 50%, probada con el reloj mockeado de
  `src/services/clock.js`, sin esperar un día real).

Los 18 tests corren contra una base PostgreSQL real (no una base en memoria),
igual que se hizo durante todo el curso.
