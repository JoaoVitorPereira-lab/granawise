const budgetService = require('../services/budgetService');

function resumo(req, res, next) {
  try {
    res.json({ resumo: budgetService.resumo(req.usuario.id, req.query) });
  } catch (err) { next(err); }
}

module.exports = { resumo };