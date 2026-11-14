// Express 4 no atrapa solo una Promise rechazada dentro de un handler async:
// si no se envuelve, un error de base de datos tira el request colgado en
// vez de responder 500. Este wrapper lo manda al manejador de errores.
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
