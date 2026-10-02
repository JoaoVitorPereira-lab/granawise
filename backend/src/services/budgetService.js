const db = require('../database/db');
const { resolverPeriodo } = require('./incomeService');
const { limitesDoMes } = require('../utils/periodo');

const arred = (n) => Math.round(n * 100) / 100;

// Calcula tudo o que o dashboard, os alertas e o chatbot precisam
function resumo(usuarioId, query) {
  const { mes, ano } = resolverPeriodo(query);
  const { inicio, fim } = limitesDoMes(mes, ano);

  const linhaRenda = db
    .prepare('SELECT valor FROM renda WHERE usuario_id = ? AND mes = ? AND ano = ?')
    .get(usuarioId, mes, ano);
  const renda = linhaRenda ? linhaRenda.valor : null;

  const linhas = db.prepare(`
    SELECT c.id, c.nome, c.limite, COALESCE(SUM(d.valor), 0) AS gasto
    FROM categorias c
    LEFT JOIN despesas d
      ON d.categoria_id = c.id AND d.usuario_id = c.usuario_id
     AND d.data >= ? AND d.data < ?
    WHERE c.usuario_id = ?
    GROUP BY c.id
    ORDER BY c.nome
  `).all(inicio, fim, usuarioId);

  const categorias = linhas.map((c) => {
    const gasto = arred(c.gasto);
    return {
      id: c.id,
      nome: c.nome,
      limite: c.limite,
      gasto,
      restante: arred(c.limite - gasto),
      percentualUsado: c.limite > 0 ? Math.round((gasto / c.limite) * 1000) / 10 : null,
      ultrapassou: gasto > c.limite,
    };
  });

  const totalGasto = arred(categorias.reduce((s, c) => s + c.gasto, 0));
  const totalLimites = arred(categorias.reduce((s, c) => s + c.limite, 0));

  const recentes = db.prepare(`
    SELECT d.id, d.descricao, d.valor, d.data, c.nome AS categoria
    FROM despesas d JOIN categorias c ON c.id = d.categoria_id
    WHERE d.usuario_id = ? AND d.data >= ? AND d.data < ?
    ORDER BY d.data DESC, d.id DESC
    LIMIT 5
  `).all(usuarioId, inicio, fim);

  return {
    mes,
    ano,
    renda,
    totalGasto,
    totalLimites,
    saldo: renda === null ? null : arred(renda - totalGasto),
    percentualRendaUsada: renda > 0 ? Math.round((totalGasto / renda) * 1000) / 10 : null,
    categorias,
    categoriasUltrapassadas: categorias.filter((c) => c.ultrapassou),
    recentes,
  };
}

module.exports = { resumo };