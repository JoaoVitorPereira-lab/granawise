const incomeService = require('../services/incomeService');

function obter(req, res, next) {
  try {
    res.json({ renda: incomeService.obter(req.usuario.id, req.query) });
  } catch (err) { next(err); }
}

function definir(req, res, next) {
  try {
    res.status(201).json({ renda: incomeService.definir(req.usuario.id, req.body) });
  } catch (err) { next(err); }
}

module.exports = { obter, definir };