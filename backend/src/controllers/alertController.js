const alertService = require('../services/alertService');

function listar(req, res, next) {
  try {
    res.json({ alertas: alertService.listar(req.usuario.id, req.query) });
  } catch (err) { next(err); }
}

module.exports = { listar };