const db = require('../database/db');
const AppError = require('../utils/AppError');
const { validarValor, validarId } = require('../utils/validators');

const CATEGORIAS_PADRAO = [
  'Despesas essenciais',
  'Alimentação',
  'Transporte',
  'Lazer',
  'Investimentos',
  'Reserva financeira',
  'Outros',
];

function validarNome(nome) {
  nome = (nome || '').trim();
  if (!nome) throw new AppError('Informe o nome da categoria.');
  if (nome.length > 50) throw new AppError('O nome deve ter no máximo 50 caracteres.');
  return nome;
}

function nomeJaExiste(usuarioId, nome, ignorarId = 0) {
  return db
    .prepare('SELECT id FROM categorias WHERE usuario_id = ? AND lower(nome) = lower(?) AND id != ?')
    .get(usuarioId, nome, ignorarId);
}

function buscar(usuarioId, id) {
  const cat = db
    .prepare('SELECT id, nome, limite FROM categorias WHERE id = ? AND usuario_id = ?')
    .get(id, usuarioId);
  if (!cat) throw new AppError('Categoria não encontrada.', 404);
  return cat;
}

function listar(usuarioId) {
  return db
    .prepare('SELECT id, nome, limite FROM categorias WHERE usuario_id = ? ORDER BY nome')
    .all(usuarioId);
}

function criar(usuarioId, { nome, limite }) {
  nome = validarNome(nome);
  limite = validarValor(limite === undefined ? 0 : limite, 'O limite');
  if (nomeJaExiste(usuarioId, nome)) throw new AppError('Você já tem uma categoria com esse nome.', 409);

  const { lastInsertRowid } = db
    .prepare('INSERT INTO categorias (usuario_id, nome, limite) VALUES (?, ?, ?)')
    .run(usuarioId, nome, limite);
  return buscar(usuarioId, lastInsertRowid);
}

function atualizar(usuarioId, idParam, { nome, limite }) {
  const id = validarId(idParam);
  buscar(usuarioId, id); // garante que a categoria é do usuário
  nome = validarNome(nome);
  limite = validarValor(limite, 'O limite');
  if (nomeJaExiste(usuarioId, nome, id)) throw new AppError('Você já tem uma categoria com esse nome.', 409);

  db.prepare('UPDATE categorias SET nome = ?, limite = ? WHERE id = ? AND usuario_id = ?')
    .run(nome, limite, id, usuarioId);
  return buscar(usuarioId, id);
}

function remover(usuarioId, idParam) {
  const id = validarId(idParam);
  buscar(usuarioId, id);

  const { total } = db
    .prepare('SELECT COUNT(*) AS total FROM despesas WHERE categoria_id = ? AND usuario_id = ?')
    .get(id, usuarioId);
  if (total > 0) {
    throw new AppError('Não é possível apagar: existem despesas nesta categoria.', 409);
  }

  db.prepare('DELETE FROM categorias WHERE id = ? AND usuario_id = ?').run(id, usuarioId);
}

// Cria as categorias padrão que o usuário ainda não tem (limite 0)
function criarPadrao(usuarioId) {
  const inserir = db.prepare('INSERT INTO categorias (usuario_id, nome, limite) VALUES (?, ?, 0)');
  const transacao = db.transaction(() => {
    for (const nome of CATEGORIAS_PADRAO) {
      if (!nomeJaExiste(usuarioId, nome)) inserir.run(usuarioId, nome);
    }
  });
  transacao();
  return listar(usuarioId);
}

module.exports = { listar, criar, atualizar, remover, criarPadrao };