const budgetService = require('./budgetService');

// Limites das regras (em %). Fáceis de ajustar e de documentar.
const CATEGORIA_PROXIMA_DO_LIMITE = 80;
const RENDA_MUITO_COMPROMETIDA = 80;
const SALDO_BAIXO = 10; // % da renda que ainda sobra

const brl = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const ORDEM = { perigo: 0, aviso: 1, info: 2 };

// Função pura: recebe o resumo do budgetService e devolve a lista de alertas.
// O chatbot (Etapa 5) também vai usá-la.
function gerar(resumo) {
  const alertas = [];
  const add = (nivel, titulo, mensagem, categoria = null) =>
    alertas.push({ nivel, titulo, mensagem, categoria });

  if (resumo.renda === null) {
    add('info', 'Renda não informada',
      'Informe a renda do mês para calcular saldo e percentuais.');
  } else {
    const { renda, saldo, percentualRendaUsada, totalLimites } = resumo;

    if (saldo < 0) {
      add('perigo', 'Saldo negativo',
        `Você gastou ${brl(Math.abs(saldo))} a mais do que a sua renda do mês.`);
    } else if (renda > 0 && (saldo / renda) * 100 <= SALDO_BAIXO) {
      add('aviso', 'Saldo baixo',
        `Restam apenas ${brl(saldo)} (${((saldo / renda) * 100).toFixed(1)}% da renda).`);
    } else if (percentualRendaUsada !== null && percentualRendaUsada >= RENDA_MUITO_COMPROMETIDA) {
      add('aviso', 'Grande parte da renda utilizada',
        `Você já usou ${percentualRendaUsada.toFixed(1)}% da renda deste mês.`);
    }

    if (totalLimites > renda) {
      add('aviso', 'Limites acima da renda',
        `A soma dos limites (${brl(totalLimites)}) é maior que a renda (${brl(renda)}).`);
    }
  }

  for (const c of resumo.categorias) {
    if (c.limite === 0 && c.gasto > 0) {
      add('aviso', `${c.nome}: sem limite`,
        `Você gastou ${brl(c.gasto)} nesta categoria, mas não definiu um limite.`, c.nome);
    } else if (c.ultrapassou) {
      add('perigo', `${c.nome}: limite ultrapassado`,
        `Gasto de ${brl(c.gasto)} para um limite de ${brl(c.limite)} (excesso de ${brl(c.gasto - c.limite)}).`,
        c.nome);
    } else if (c.percentualUsado !== null && c.percentualUsado >= CATEGORIA_PROXIMA_DO_LIMITE) {
      add('aviso', `${c.nome}: perto do limite`,
        `Você já usou ${c.percentualUsado.toFixed(1)}% do limite. Restam ${brl(c.restante)}.`,
        c.nome);
    }
  }

  return alertas.sort((a, b) => ORDEM[a.nivel] - ORDEM[b.nivel]);
}

function listar(usuarioId, query) {
  return gerar(budgetService.resumo(usuarioId, query));
}

module.exports = { gerar, listar };