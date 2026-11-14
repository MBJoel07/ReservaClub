// R4 de la spec: 401 = no sabemos quien sos. 403 = sabemos quien sos pero
// no podes pasar.
const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [esquema, token] = header.split(" ");

  if (esquema !== "Bearer" || !token) {
    return res.status(401).json({ error: "No autenticado: falta el token." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = payload; // { id, email, rol }
    next();
  } catch (err) {
    return res.status(401).json({ error: "No autenticado: token invalido o vencido." });
  }
}

// Requiere que req.usuario (ya puesto por requireAuth) tenga uno de los
// roles permitidos. Siempre se usa DESPUES de requireAuth.
function requireRole(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: "No autenticado." });
    }
    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ error: "No tenes permiso para hacer esto." });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
