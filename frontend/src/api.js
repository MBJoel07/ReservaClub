// Este archivo es "Postman con botones": arma el JSON y lo manda al mismo
// backend que cualquiera podria llamar a mano. No decide precios, no decide
// si un turno esta disponible, no decide penalidades: eso vive en el
// backend (spec.md). Esto solo manda el request y devuelve la respuesta.

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

async function pedido(metodo, ruta, { token, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${ruta}`, {
    method: metodo,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || `Error ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return data;
}

export const api = {
  registro: (email, password, rol) => pedido("POST", "/auth/registro", { body: { email, password, rol } }),
  login: (email, password) => pedido("POST", "/auth/login", { body: { email, password } }),
  canchas: () => pedido("GET", "/canchas"),
  turnos: (canchaId, fecha, token) =>
    pedido("GET", `/turnos?cancha_id=${canchaId}&fecha=${fecha}`, { token }),
  reservar: (canchaId, fecha, horaInicio, token) =>
    pedido("POST", "/reservas", { token, body: { cancha_id: canchaId, fecha, hora_inicio: horaInicio } }),
  misReservas: (token) => pedido("GET", "/reservas/mias", { token }),
  cancelar: (id, token) => pedido("DELETE", `/reservas/${id}`, { token }),
  deudas: (token) => pedido("GET", "/admin/deudas", { token }),
};
