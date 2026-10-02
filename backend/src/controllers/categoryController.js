const categoryService = require('../services/categoryService');

function listar(req, res, next) {
  try {
    res.json({ categorias: categoryService.listar(req.usuario.id) });
  } catch (err) { next(err); }
}

function criar(req, res, next) {
  try {
    res.status(201).json({ categoria: categoryService.criar(req.usuario.id, req.body) });
  } catch (err) { next(err); }
}

function atualizar(req, res, next) {
  try {
    res.json({ categoria: categoryService.atualizar(req.usuario.id, req.params.id, req.body) });
  } catch (err) { next(err); }
}

function remover(req, res, next) {
  try {
    categoryService.remover(req.usuario.id, req.params.id);
    res.json({ mensagem: 'Categoria removida.' });
  } catch (err) { next(err); }
}

function criarPadrao(req, res, next) {
  try {
    res.status(201).json({ categorias: categoryService.criarPadrao(req.usuario.id) });
  } catch (err) { next(err); }
}

module.exports = { listar, criar, atualizar, remover, criarPadrao };