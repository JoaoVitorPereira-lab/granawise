const db = require('../database/db');
const AppError = require('../utils/AppError');
const { validarValor } = require('../utils/validators');

// Usa o mês/ano atuais quando não informados
function resolverPeriodo({ mes, ano } = {}) {
  const hoje = new Date();
  mes = mes === undefined || mes === '' ? hoje.getMonth() + 1 : Number(mes);
  ano = ano === undefined || ano === '' ? hoje.getFullYear() : Number(ano);

  if (!Number.isInteger(mes) || mes < 1 || mes > 12) throw new AppError('Mês inválido.');
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) throw new AppError('Ano inválido.');
  return { mes, ano };
}

function obter(usuarioId, query) {
  const { mes, ano } = resolverPeriodo(query);
  const linha = db
    .prepare('SELECT valor FROM renda WHERE usuario_id = ? AND mes = ? AND ano = ?')
    .get(usuarioId, mes, ano);
  return { mes, ano, valor: linha ? linha.valor : null };
}

function definir(usuarioId, body) {
  const { mes, ano } = resolverPeriodo(body);
  const valor = validarValor(body.valor, 'A renda');

  // Se já existe renda no mês, atualiza; senão, cria
  db.prepare(`
    INSERT INTO renda (usuario_id, valor, mes, ano) VALUES (?, ?, ?, ?)
    ON CONFLICT (usuario_id, mes, ano) DO UPDATE SET valor = excluded.valor
  `).run(usuarioId, valor, mes, ano);

  return { mes, ano, valor };
}

module.exports = { obter, definir, resolverPeriodo };