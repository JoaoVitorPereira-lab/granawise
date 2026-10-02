const budgetService = require('./budgetService');
const alertService = require('./alertService');
const AppError = require('../utils/AppError');

const brl = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (n) => n.toFixed(1).replace('.', ',') + '%';

function formatarData(iso) {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

const SAUDACAO = 'Olá! Sou o assistente financeiro. Como posso ajudar?';
const SEM_RENDA =
  'Você ainda não informou a renda deste mês. Informe-a no painel "Renda mensal" para eu calcular isso.';
const SEM_CATEGORIAS =
  'Você ainda não criou categorias. Crie-as no painel "Categorias e limites" para planejar o orçamento.';

const OPCOES = [
  { id: 'saldo', rotulo: 'Consultar meu saldo' },
  { id: 'gastos', rotulo: 'Ver meus gastos' },
  { id: 'orcamento', rotulo: 'Analisar meu orçamento' },
  { id: 'categorias', rotulo: 'Ver limite das categorias' },
  { id: 'alertas', rotulo: 'Ver alertas' },
  { id: 'disponivel', rotulo: 'Quanto ainda posso gastar?' },
];

// Cada opção recebe o resumo do mês e devolve uma lista de linhas de texto
const respostas = {
  saldo(r) {
    if (r.renda === null) return [SEM_RENDA];
    const frase = r.saldo >= 0
      ? `Você possui ${brl(r.saldo)} disponíveis neste mês.`
      : `Você ultrapassou a renda do mês em ${brl(Math.abs(r.saldo))}.`;
    return [
      frase,
      `Renda: ${brl(r.renda)}`,
      `Despesas: ${brl(r.totalGasto)}`,
      `Saldo: ${brl(r.saldo)}`,
    ];
  },

  gastos(r) {
    if (r.recentes.length === 0) return ['Você ainda não registrou despesas neste mês.'];
    const total = r.percentualRendaUsada !== null
      ? `Total gasto: ${brl(r.totalGasto)} (${pct(r.percentualRendaUsada)} da renda).`
      : `Total gasto: ${brl(r.totalGasto)}.`;
    const linhas = [total, 'Últimas despesas:'];
    for (const d of r.recentes) {
      linhas.push(`• ${formatarData(d.data)} - ${d.descricao} (${d.categoria}): ${brl(d.valor)}`);
    }
    return linhas;
  },

  orcamento(r) {
    if (r.categorias.length === 0) return [SEM_CATEGORIAS];
    const linhas = [];

    if (r.renda !== null && r.renda > 0) {
      linhas.push(
        `Você distribuiu ${brl(r.totalLimites)} em limites (${pct((r.totalLimites / r.renda) * 100)} da renda de ${brl(r.renda)}).`
      );
      if (r.totalLimites > r.renda) {
        linhas.push('Seus limites somam mais do que a renda. Vale revisar o planejamento.');
      }
    } else {
      linhas.push(`Total dos limites: ${brl(r.totalLimites)}.`);
    }
    linhas.push(`Gasto até agora: ${brl(r.totalGasto)}.`);

    const estouradas = r.categoriasUltrapassadas.filter((c) => c.limite > 0);
    const semLimite = r.categorias.filter((c) => c.limite === 0 && c.gasto > 0);

    if (estouradas.length > 0) {
      linhas.push(
        `Atenção: ${estouradas.length === 1 ? '1 categoria ultrapassou' : `${estouradas.length} categorias ultrapassaram`} o limite: ${estouradas.map((c) => c.nome).join(', ')}.`
      );
    } else {
      linhas.push('Nenhuma categoria ultrapassou o limite.');
    }
    if (semLimite.length > 0) {
      linhas.push(`Categorias com gasto e sem limite definido: ${semLimite.map((c) => c.nome).join(', ')}.`);
    }
    return linhas;
  },

  categorias(r) {
    if (r.categorias.length === 0) return [SEM_CATEGORIAS];
    const linhas = ['Limite e uso de cada categoria:'];
    for (const c of r.categorias) {
      if (c.limite === 0) {
        linhas.push(`• ${c.nome}: sem limite definido (gasto ${brl(c.gasto)})`);
      } else {
        const situacao = c.restante >= 0
          ? `restam ${brl(c.restante)}`
          : `excedeu em ${brl(Math.abs(c.restante))}`;
        linhas.push(`• ${c.nome}: limite ${brl(c.limite)}, gasto ${brl(c.gasto)}, ${situacao}`);
      }
    }
    return linhas;
  },

  alertas(r) {
    const lista = alertService.gerar(r);
    if (lista.length === 0) return ['Nenhum alerta neste mês. Está tudo dentro do planejado.'];
    const titulo = lista.length === 1 ? 'Você tem 1 alerta:' : `Você tem ${lista.length} alertas:`;
    return [titulo, ...lista.map((a) => `• ${a.titulo}: ${a.mensagem}`)];
  },

  disponivel(r) {
    if (r.renda === null) return [SEM_RENDA];
    if (r.saldo < 0) {
      return [`Você já ultrapassou a renda em ${brl(Math.abs(r.saldo))}. O ideal é evitar novos gastos neste mês.`];
    }
    if (r.saldo === 0) return ['Seu saldo está zerado. Não há mais dinheiro disponível neste mês.'];

    const linhas = [`Você ainda pode gastar até ${brl(r.saldo)} neste mês.`];

    // Folga somando só o que ainda resta nas categorias que têm limite
    const comLimite = r.categorias.filter((c) => c.limite > 0);
    if (comLimite.length > 0) {
      const folga = comLimite.reduce((soma, c) => soma + Math.max(0, c.restante), 0);
      linhas.push(`Dentro dos limites das categorias, ainda restam ${brl(folga)}.`);
    }

    // Média diária, só faz sentido para o mês atual
    const hoje = new Date();
    if (r.mes === hoje.getMonth() + 1 && r.ano === hoje.getFullYear()) {
      const ultimoDia = new Date(r.ano, r.mes, 0).getDate();
      const dias = ultimoDia - hoje.getDate() + 1; // conta o dia de hoje
      linhas.push(
        `Restam ${dias} ${dias === 1 ? 'dia' : 'dias'} no mês (contando hoje), o que dá cerca de ${brl(r.saldo / dias)} por dia.`
      );
    }
    return linhas;
  },
};

function menu() {
  return { saudacao: SAUDACAO, opcoes: OPCOES };
}

function responder(usuarioId, opcao, query) {
  // Só aceita opções da lista (evita executar qualquer nome vindo da URL)
  if (!Object.prototype.hasOwnProperty.call(respostas, opcao)) {
    throw new AppError('Opção não reconhecida.', 404);
  }
  const resumo = budgetService.resumo(usuarioId, query);
  return { opcao, resposta: respostas[opcao](resumo) };
}

module.exports = { menu, responder };