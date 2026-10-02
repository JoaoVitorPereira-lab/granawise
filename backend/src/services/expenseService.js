const db = require('../database/db');
const AppError = require('../utils/AppError');
const { validarValor, validarId } = require('../utils/validators');
const { resolverPeriodo } = require('./incomeService');
const { limitesDoMes } = require('../utils/periodo');

function validarDescricao(descricao) {
  descricao = (descricao || '').trim();
  if (!descricao) throw new AppError('Informe a descrição da despesa.');
  if (descricao.length > 100) throw new AppError('A descrição deve ter no máximo 100 caracteres.');
  return descricao;
}

function validarData(data) {
  if (typeof data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    throw new AppError('Data inválida.');
  }
  const [a, m, d] = data.split('-').map(Number);
  const dt = new Date(a, m - 1, d);
  if (a < 2000 || a > 2100 || dt.getFullYear() !== a || dt.getMonth() !== m - 1 || dt.getDate() !== d) {
    throw new AppError('Data inválida.');
  }
  return data;
}

function validarValorDespesa(valor) {
  const v = validarValor(valor, 'O valor');
  if (v <= 0) throw new AppError('O valor deve ser maior que zero.');
  return v;
}

// A categoria precisa existir E pertencer ao usuário
function validarCategoria(usuarioId, categoriaId) {
  const id = Number(categoriaId);
  if (!Number.isInteger(id) || id <= 0) throw new AppError('Categoria inválida.');
  const cat = db
    .prepare('SELECT id FROM categorias WHERE id = ? AND usuario_id = ?')
    .get(id, usuarioId);
  if (!cat) throw new AppError('Categoria inválida.');
  return id;
}

function buscar(usuarioId, id) {
  const despesa = db.prepare(`
    SELECT d.id, d.descricao, d.valor, d.data, d.categoria_id, c.nome AS categoria
    FROM despesas d JOIN categorias c ON c.id = d.categoria_id
    WHERE d.id = ? AND d.usuario_id = ?
  `).get(id, usuarioId);
  if (!despesa) throw new AppError('Despesa não encontrada.', 404);
  return despesa;
}

function listar(usuarioId, query) {
  const { mes, ano } = resolverPeriodo(query);
  const { inicio, fim } = limitesDoMes(mes, ano);
  return db.prepare(`
    SELECT d.id, d.descricao, d.valor, d.data, d.categoria_id, c.nome AS categoria
    FROM despesas d JOIN categorias c ON c.id = d.categoria_id
    WHERE d.usuario_id = ? AND d.data >= ? AND d.data < ?
    ORDER BY d.data DESC, d.id DESC
  `).all(usuarioId, inicio, fim);
}

function criar(usuarioId, body) {
  const descricao = validarDescricao(body.descricao);
  const valor = validarValorDespesa(body.valor);
  const data = validarData(body.data);
  const categoriaId = validarCategoria(usuarioId, body.categoria_id);

  const { lastInsertRowid } = db
    .prepare('INSERT INTO despesas (usuario_id, categoria_id, descricao, valor, data) VALUES (?, ?, ?, ?, ?)')
    .run(usuarioId, categoriaId, descricao, valor, data);
  return buscar(usuarioId, lastInsertRowid);
}

function atualizar(usuarioId, idParam, body) {
  const id = validarId(idParam);
  buscar(usuarioId, id);
  const descricao = validarDescricao(body.descricao);
  const valor = validarValorDespesa(body.valor);
  const data = validarData(body.data);
  const categoriaId = validarCategoria(usuarioId, body.categoria_id);

  db.prepare(`
    UPDATE despesas SET descricao = ?, valor = ?, data = ?, categoria_id = ?
    WHERE id = ? AND usuario_id = ?
  `).run(descricao, valor, data, categoriaId, id, usuarioId);
  return buscar(usuarioId, id);
}

function remover(usuarioId, idParam) {
  const id = validarId(idParam);
  buscar(usuarioId, id);
  db.prepare('DELETE FROM despesas WHERE id = ? AND usuario_id = ?').run(id, usuarioId);
}

module.exports = { listar, criar, atualizar, remover };