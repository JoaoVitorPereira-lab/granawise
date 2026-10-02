const request = require('supertest');
const app = require('../../src/app');
const { criarUsuarioLogado, dataHoje, mesAnterior } = require('../helpers');

async function criarCategoria(agent, nome, limite) {
  const r = await agent.post('/api/categories').send({ nome, limite });
  return r.body.categoria;
}

function despesa(categoria_id, extra = {}) {
  return { descricao: 'Mercado', valor: 100, data: dataHoje(), categoria_id, ...extra };
}

// Junta as linhas da resposta em um único texto, para facilitar as verificações
async function perguntar(agent, opcao, query = '') {
  const r = await agent.get(`/api/chatbot/${opcao}${query}`);
  return { status: r.status, linhas: r.body.resposta || [], texto: (r.body.resposta || []).join('\n') };
}

describe('Chatbot: menu e segurança', () => {
  test('o menu traz a saudação e as 6 opções esperadas', async () => {
    const { agent } = await criarUsuarioLogado();
    const { body } = await agent.get('/api/chatbot');

    expect(body.saudacao).toContain('assistente');
    expect(body.opcoes.map((o) => o.id)).toEqual(
      ['saldo', 'gastos', 'orcamento', 'categorias', 'alertas', 'disponivel']
    );
  });

  test('exige login no menu e nas respostas', async () => {
    expect((await request(app).get('/api/chatbot')).status).toBe(401);
    expect((await request(app).get('/api/chatbot/saldo')).status).toBe(401);
  });

  test('recusa opção desconhecida, inclusive nomes internos do JavaScript', async () => {
    const { agent } = await criarUsuarioLogado();
    for (const opcao of ['xyz', 'constructor', 'toString', 'hasOwnProperty']) {
      const r = await agent.get(`/api/chatbot/${opcao}`);
      expect(r.status).toBe(404);
    }
  });

  test('recusa mês inválido', async () => {
    const { agent } = await criarUsuarioLogado();
    const r = await agent.get('/api/chatbot/saldo?mes=13');
    expect(r.status).toBe(400);
  });
});

describe('Chatbot: conta nova (sem renda e sem categorias)', () => {
  let agent;
  beforeAll(async () => { ({ agent } = await criarUsuarioLogado()); });

  test('saldo e "quanto posso gastar" pedem para informar a renda', async () => {
    expect((await perguntar(agent, 'saldo')).texto).toContain('não informou a renda');
    expect((await perguntar(agent, 'disponivel')).texto).toContain('não informou a renda');
  });

  test('orçamento e categorias avisam que não há categorias', async () => {
    expect((await perguntar(agent, 'orcamento')).texto).toContain('não criou categorias');
    expect((await perguntar(agent, 'categorias')).texto).toContain('não criou categorias');
  });

  test('gastos avisa que não há despesas', async () => {
    expect((await perguntar(agent, 'gastos')).texto).toContain('não registrou despesas');
  });

  test('alertas mostra apenas "Renda não informada"', async () => {
    const r = await perguntar(agent, 'alertas');
    expect(r.linhas[0]).toBe('Você tem 1 alerta:');
    expect(r.texto).toContain('Renda não informada');
  });
});

describe('Chatbot: cenário completo', () => {
  // Renda 3000 | Alimentação (limite 800) gasto 250 | Lazer (limite 200) gasto 250
  // Transporte (sem limite) gasto 50 | total gasto 550 | saldo 2450
  let agent;

  beforeAll(async () => {
    ({ agent } = await criarUsuarioLogado());
    await agent.post('/api/income').send({ valor: 3000 });
    const alimentacao = await criarCategoria(agent, 'Alimentação', 800);
    const lazer = await criarCategoria(agent, 'Lazer', 200);
    const transporte = await criarCategoria(agent, 'Transporte', 0);
    await agent.post('/api/expenses').send(despesa(alimentacao.id, { descricao: 'Mercado', valor: 250 }));
    await agent.post('/api/expenses').send(despesa(lazer.id, { descricao: 'Cinema', valor: 250 }));
    await agent.post('/api/expenses').send(despesa(transporte.id, { descricao: 'Ônibus', valor: 50 }));
  });

  test('saldo: frase principal, renda, despesas e saldo', async () => {
    const r = await perguntar(agent, 'saldo');
    expect(r.linhas[0]).toMatch(/Você possui .*2\.450,00 disponíveis neste mês\./);
    expect(r.texto).toContain('Renda:');
    expect(r.texto).toContain('550,00');
  });

  test('gastos: total, percentual da renda e últimas despesas', async () => {
    const r = await perguntar(agent, 'gastos');
    expect(r.linhas[0]).toContain('550,00');
    expect(r.linhas[0]).toContain('18,3%');
    expect(r.texto).toContain('Últimas despesas:');
    expect(r.texto).toContain('Mercado');
    expect(r.texto).toContain('Cinema');
    expect(r.texto).toContain('Ônibus');
  });

  test('orçamento: limites distribuídos, categoria estourada e categoria sem limite', async () => {
    const r = await perguntar(agent, 'orcamento');
    expect(r.texto).toContain('1.000,00');        // soma dos limites
    expect(r.texto).toContain('33,3%');           // 1000 de 3000
    expect(r.texto).toContain('1 categoria ultrapassou o limite: Lazer');
    expect(r.texto).toContain('sem limite definido: Transporte');
    expect(r.texto).not.toContain('Nenhuma categoria ultrapassou');
  });

  test('categorias: restante, excesso e "sem limite" de cada uma', async () => {
    const r = await perguntar(agent, 'categorias');
    expect(r.texto).toMatch(/Alimentação: limite .*800,00, gasto .*250,00, restam .*550,00/);
    expect(r.texto).toMatch(/Lazer: limite .*200,00, gasto .*250,00, excedeu em .*50,00/);
    expect(r.texto).toMatch(/Transporte: sem limite definido/);
  });

  test('alertas: mesmos alertas da Etapa 4, com o mais grave primeiro', async () => {
    const r = await perguntar(agent, 'alertas');
    expect(r.linhas[0]).toBe('Você tem 2 alertas:');
    expect(r.linhas[1]).toContain('Lazer: limite ultrapassado');
    expect(r.linhas[2]).toContain('Transporte: sem limite');
  });

  test('disponível: saldo, folga dentro dos limites e média por dia', async () => {
    const r = await perguntar(agent, 'disponivel');
    expect(r.linhas[0]).toMatch(/Você ainda pode gastar até .*2\.450,00 neste mês\./);
    // Folga = só o que resta em categorias com limite (Alimentação 550; Lazer estourada conta 0)
    expect(r.texto).toMatch(/ainda restam .*550,00/);
    expect(r.texto).toMatch(/Restam \d+ (dia|dias) no mês/);
  });
});

describe('Chatbot: situações específicas', () => {
  test('orçamento: limites somando mais que a renda', async () => {
    const { agent } = await criarUsuarioLogado();
    await agent.post('/api/income').send({ valor: 500 });
    await criarCategoria(agent, 'Alimentação', 800);

    const r = await perguntar(agent, 'orcamento');
    expect(r.texto).toContain('160,0%');
    expect(r.texto).toContain('limites somam mais do que a renda');
    expect(r.texto).toContain('Nenhuma categoria ultrapassou o limite.');
  });

  test('orçamento: com categorias, mas sem renda informada', async () => {
    const { agent } = await criarUsuarioLogado();
    await criarCategoria(agent, 'Lazer', 200);

    const r = await perguntar(agent, 'orcamento');
    expect(r.linhas[0]).toContain('Total dos limites');
    expect(r.texto).toContain('200,00');
  });

  test('alertas: sem nenhum alerta, mostra mensagem positiva', async () => {
    const { agent } = await criarUsuarioLogado();
    await agent.post('/api/income').send({ valor: 1000 });

    const r = await perguntar(agent, 'alertas');
    expect(r.texto).toContain('Nenhum alerta neste mês');
  });

  test('saldo negativo: avisa que ultrapassou a renda', async () => {
    const { agent } = await criarUsuarioLogado();
    await agent.post('/api/income').send({ valor: 100 });
    const cat = await criarCategoria(agent, 'Outros', 500);
    await agent.post('/api/expenses').send(despesa(cat.id, { valor: 150 }));

    const saldo = await perguntar(agent, 'saldo');
    expect(saldo.linhas[0]).toMatch(/Você ultrapassou a renda do mês em .*50,00\./);

    const disponivel = await perguntar(agent, 'disponivel');
    expect(disponivel.texto).toMatch(/Você já ultrapassou a renda em .*50,00/);
  });

  test('saldo zerado: avisa que não há dinheiro disponível', async () => {
    const { agent } = await criarUsuarioLogado();
    await agent.post('/api/income').send({ valor: 250 });
    const cat = await criarCategoria(agent, 'Outros', 500);
    await agent.post('/api/expenses').send(despesa(cat.id, { valor: 250 }));

    const r = await perguntar(agent, 'disponivel');
    expect(r.texto).toContain('saldo está zerado');
  });

  test('gastos: sem renda informada, mostra o total sem percentual', async () => {
    const { agent } = await criarUsuarioLogado();
    const cat = await criarCategoria(agent, 'Outros', 500);
    await agent.post('/api/expenses').send(despesa(cat.id, { valor: 80 }));

    const r = await perguntar(agent, 'gastos');
    expect(r.linhas[0]).toContain('80,00');
    expect(r.linhas[0]).not.toContain('%');
  });

  test('gastos: mostra no máximo as 5 despesas mais recentes', async () => {
    const { agent } = await criarUsuarioLogado();
    const cat = await criarCategoria(agent, 'Outros', 500);
    for (let i = 1; i <= 7; i++) {
      await agent.post('/api/expenses').send(despesa(cat.id, { descricao: `Compra ${i}`, valor: 10 }));
    }

    const r = await perguntar(agent, 'gastos');
    const itens = r.linhas.filter((l) => l.startsWith('•'));
    expect(itens).toHaveLength(5);
  });

  test('responde sobre o mês pedido na URL, e não sobre o mês atual', async () => {
    const { agent } = await criarUsuarioLogado();
    const anterior = mesAnterior();
    await agent.post('/api/income').send({ valor: 2000, mes: anterior.mes, ano: anterior.ano });

    const passado = await perguntar(agent, 'saldo', `?mes=${anterior.mes}&ano=${anterior.ano}`);
    expect(passado.texto).toContain('2.000,00');

    const atual = await perguntar(agent, 'saldo');
    expect(atual.texto).toContain('não informou a renda');
  });

  test('"quanto posso gastar" em outro mês não calcula média por dia', async () => {
    const { agent } = await criarUsuarioLogado();
    const anterior = mesAnterior();
    await agent.post('/api/income').send({ valor: 2000, mes: anterior.mes, ano: anterior.ano });

    const r = await perguntar(agent, 'disponivel', `?mes=${anterior.mes}&ano=${anterior.ano}`);
    expect(r.texto).toContain('2.000,00');
    expect(r.texto).not.toMatch(/Restam \d+ (dia|dias) no mês/);
  });
});