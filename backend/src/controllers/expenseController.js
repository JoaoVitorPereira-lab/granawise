const expenseService = require('../services/expenseService');

function listar(req, res, next) {
  try {
    res.json({ despesas: expenseService.listar(req.usuario.id, req.query) });
  } catch (err) { next(err); }
}

function criar(req, res, next) {
  try {
    res.status(201).json({ despesa: expenseService.criar(req.usuario.id, req.body) });
  } catch (err) { next(err); }
}

function atualizar(req, res, next) {
  try {
    res.json({ despesa: expenseService.atualizar(req.usuario.id, req.params.id, req.body) });
  } catch (err) { next(err); }
}

function remover(req, res, next) {
  try {
    expenseService.remover(req.usuario.id, req.params.id);
    res.json({ mensagem: 'Despesa removida.' });
  } catch (err) { next(err); }
}

module.exports = { listar, criar, atualizar, remover };