import { useEffect, useState } from "react";
import { api } from "./api.js";

// Lee el payload del JWT solo para mostrar el email/rol en la pantalla.
// Esto NO es una verificacion de seguridad (eso lo hace el backend con la
// firma); es nomas para que la interfaz sepa a quien saludar.
function leerPayload(token) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function App() {
  const [token, setToken] = useState(null);
  const [usuario, setUsuario] = useState(null);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    if (token) setUsuario(leerPayload(token));
  }, [token]);

  if (!token) {
    return (
      <div className="contenedor">
        <h1>ReservaClub</h1>
        <PantallaLogin
          onLogin={(t) => setToken(t)}
          mensaje={mensaje}
          setMensaje={setMensaje}
        />
      </div>
    );
  }

  return (
    <div className="contenedor">
      <header className="encabezado">
        <h1>ReservaClub</h1>
        <div>
          <span>
            {usuario?.email} ({usuario?.rol})
          </span>
          <button onClick={() => setToken(null)}>Salir</button>
        </div>
      </header>

      <PantallaReservar token={token} />
      <PantallaMisReservas token={token} />
      {usuario?.rol === "admin" && <PantallaAdmin token={token} />}
    </div>
  );
}

function PantallaLogin({ onLogin, mensaje, setMensaje }) {
  const [modo, setModo] = useState("login"); // 'login' | 'registro'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState("socio");

  async function enviar(e) {
    e.preventDefault();
    setMensaje("");
    try {
      if (modo === "registro") {
        await api.registro(email, password, rol);
        setMensaje("Cuenta creada. Ahora inicia sesion.");
        setModo("login");
        return;
      }
      const { token } = await api.login(email, password);
      onLogin(token);
    } catch (err) {
      setMensaje(err.message);
    }
  }

  return (
    <form className="tarjeta" onSubmit={enviar}>
      <h2>{modo === "login" ? "Iniciar sesion" : "Crear cuenta"}</h2>
      <label>
        Email
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
      </label>
      <label>
        Password
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
      </label>
      {modo === "registro" && (
        <label>
          Soy
          <select value={rol} onChange={(e) => setRol(e.target.value)}>
            <option value="socio">Socio</option>
            <option value="no_socio">No socio</option>
          </select>
        </label>
      )}
      <button type="submit">{modo === "login" ? "Entrar" : "Registrarme"}</button>
      <button type="button" className="enlace" onClick={() => setModo(modo === "login" ? "registro" : "login")}>
        {modo === "login" ? "¿No tenes cuenta? Registrate" : "Ya tengo cuenta"}
      </button>
      {mensaje && <p className="error">{mensaje}</p>}
    </form>
  );
}

function PantallaReservar({ token }) {
  const [canchas, setCanchas] = useState([]);
  const [canchaId, setCanchaId] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [turnos, setTurnos] = useState([]);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    api.canchas().then((lista) => {
      setCanchas(lista);
      if (lista[0]) setCanchaId(String(lista[0].id));
    });
  }, []);

  useEffect(() => {
    if (!canchaId || !fecha) return;
    api.turnos(canchaId, fecha, token).then((r) => setTurnos(r.turnos));
  }, [canchaId, fecha, token]);

  async function reservar(hora) {
    setMensaje("");
    try {
      await api.reservar(canchaId, fecha, hora, token);
      setMensaje(`Turno de las ${hora} reservado.`);
      api.turnos(canchaId, fecha, token).then((r) => setTurnos(r.turnos));
    } catch (err) {
      setMensaje(err.message);
    }
  }

  return (
    <section className="tarjeta">
      <h2>Reservar turno</h2>
      <div className="fila">
        <label>
          Cancha
          <select value={canchaId} onChange={(e) => setCanchaId(e.target.value)}>
            {canchas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} ({c.deporte})
              </option>
            ))}
          </select>
        </label>
        <label>
          Fecha
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </label>
      </div>

      <table>
        <thead>
          <tr>
            <th>Hora</th>
            <th>Precio</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {turnos.map((t) => (
            <tr key={t.hora_inicio}>
              <td>{t.hora_inicio}</td>
              <td>${t.precio.toLocaleString("es-AR")}</td>
              <td>{t.disponible ? "Libre" : "Reservado"}</td>
              <td>
                <button disabled={!t.disponible} onClick={() => reservar(t.hora_inicio)}>
                  Reservar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {mensaje && <p>{mensaje}</p>}
    </section>
  );
}

function PantallaMisReservas({ token }) {
  const [reservas, setReservas] = useState([]);
  const [mensaje, setMensaje] = useState("");

  function recargar() {
    api.misReservas(token).then(setReservas);
  }

  useEffect(recargar, [token]);

  async function cancelar(id) {
    setMensaje("");
    try {
      const r = await api.cancelar(id, token);
      setMensaje(
        r.deuda_generada
          ? `Cancelado. Como fue con menos de 24hs de anticipacion, quedo una deuda de $${r.monto_deuda}.`
          : "Cancelado sin penalidad."
      );
      recargar();
    } catch (err) {
      setMensaje(err.message);
    }
  }

  return (
    <section className="tarjeta">
      <h2>Mis reservas</h2>
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Hora</th>
            <th>Precio</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {reservas.map((r) => (
            <tr key={r.id}>
              <td>{String(r.fecha).slice(0, 10)}</td>
              <td>{r.hora_inicio}</td>
              <td>${Number(r.precio_cobrado).toLocaleString("es-AR")}</td>
              <td>
                {r.estado}
                {r.deuda_generada && ` (deuda: $${Number(r.monto_deuda).toLocaleString("es-AR")})`}
              </td>
              <td>
                {r.estado === "confirmada" && <button onClick={() => cancelar(r.id)}>Cancelar</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {mensaje && <p>{mensaje}</p>}
    </section>
  );
}

function PantallaAdmin({ token }) {
  const [deudas, setDeudas] = useState([]);

  useEffect(() => {
    api.deudas(token).then(setDeudas);
  }, [token]);

  return (
    <section className="tarjeta">
      <h2>Admin: deudas pendientes</h2>
      <table>
        <thead>
          <tr>
            <th>Usuario</th>
            <th>Fecha</th>
            <th>Hora</th>
            <th>Deuda</th>
          </tr>
        </thead>
        <tbody>
          {deudas.map((d) => (
            <tr key={d.id}>
              <td>{d.email}</td>
              <td>{String(d.fecha).slice(0, 10)}</td>
              <td>{d.hora_inicio}</td>
              <td>${Number(d.monto_deuda).toLocaleString("es-AR")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
