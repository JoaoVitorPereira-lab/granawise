const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/database/db');
const { criarUsuarioLogado, dataHoje, mesAnterior } = require('../helpers');

async function criarCategoria(agent, nome, limite) {
  const r = await agent.post('/api/categories').send({ nome, limite });
  return r.body.categoria;
}

function despesa(categoria_id, extra = {}) {
  return { descricao: 'Mercado', valor: 250, data: dataHoje(), categoria_id, ...extra };
}

describe('Renda', () => {
  test('exige login', async () => {
    const r = await request(app).get('/api/income');
    expect(r.status).toBe(401);
  });

  test('define e atualiza a renda do mês (sem duplicar)', async () => {
    const { agent } = await criarUsuarioLogado();

    const primeira = await agent.post('/api/income').send({ valor: '3000,50' });
    expect(primeira.status).toBe(201);
    expect(primeira.body.renda.valor).toBe(3000.5);

    await agent.post('/api/income').send({ valor: 4000 });
    const atual = await agent.get('/api/income');
    expect(atual.body.renda.valor).toBe(4000);
  });

  test('rejeita valor negativo e texto', async () => {
    const { agent } = await criarUsuarioLogado();
    expect((await agent.post('/api/income').send({ valor: -10 })).status).toBe(400);
    expect((await agent.post('/api/income').send({ valor: 'abc' })).status).toBe(400);
  });
});

describe('Categorias', () => {
  test('cria, lista, edita e apaga', async () => {
    const { agent } = await criarUsuarioLogado();
    const cat = await criarCategoria(agent, 'Alimentação', 800);
    expect(cat.limite).toBe(800);

    const lista = await agent.get('/api/categories');
    expect(lista.body.categorias).toHaveLength(1);

    const editada = await agent.put(`/api/categories/${cat.id}`).send({ nome: 'Comida', limite: 900 });
    expect(editada.body.categoria).toMatchObject({ nome: 'Comida', limite: 900 });

    const apagada = await agent.delete(`/api/categories/${cat.id}`);
    expect(apagada.status).toBe(200);
  });

  test('recusa nome duplicado (sem diferenciar maiúsculas) e limite negativo', async () => {
    const { agent } = await criarUsuarioLogado();
    await criarCategoria(agent, 'Lazer', 100);

    const duplicada = await agent.post('/api/categories').send({ nome: 'lazer', limite: 50 });
    expect(duplicada.status).toBe(409);

    const negativa = await agent.post('/api/categories').send({ nome: 'Outra', limite: -10 });
    expect(negativa.status).toBe(400);
  });

  test('categorias padrão: cria 7 e não duplica na segunda vez', async () => {
    const { agent } = await criarUsuarioLogado();
    const primeira = await agent.post('/api/categories/defaults');
    expect(primeira.body.categorias).toHaveLength(7);
    const segunda = await agent.post('/api/categories/defaults');
    expect(segunda.body.categorias).toHaveLength(7);
  });

  test('não apaga categoria que tem despesas', async () => {
    const { agent } = await criarUsuarioLogado();
    const cat = await criarCategoria(agent, 'Transporte', 200);
    await agent.post('/api/expenses').send(despesa(cat.id));

    const r = await agent.delete(`/api/categories/${cat.id}`);
    expect(r.status).toBe(409);
  });

  test('nome com SQL malicioso é tratado como texto e não afeta o banco', async () => {
    const { agent } = await criarUsuarioLogado();
    const nome = "x'); DROP TABLE usuarios; --";
    const r = await agent.post('/api/categories').send({ nome, limite: 10 });
    expect(r.status).toBe(201);
    expect(r.body.categoria.nome).toBe(nome);

    const { n } = db.prepare('SELECT COUNT(*) AS n FROM usuarios').get();
    expect(n).toBeGreaterThan(0);
  });
});

describe('Despesas', () => {
  test('cria, lista, edita e apaga', async () => {
    const { agent } = await criarUsuarioLogado();
    const cat = await criarCategoria(agent, 'Alimentação', 800);

    const criada = await agent.post('/api/expenses').send(despesa(cat.id));
    expect(criada.status).toBe(201);
    expect(criada.body.despesa.categoria).toBe('Alimentação');

    const lista = await agent.get('/api/expenses');
    expect(lista.body.despesas).toHaveLength(1);

    const editada = await agent.put(`/api/expenses/${criada.body.despesa.id}`)
      .send(despesa(cat.id, { valor: 300 }));
    expect(editada.body.despesa.valor).toBe(300);

    const apagada = await agent.delete(`/api/expenses/${criada.body.despesa.id}`);
    expect(apagada.status).toBe(200);
    expect((await agent.get('/api/expenses')).body.despesas).toHaveLength(0);
  });

  test('valida valor, data e descrição', async () => {
    const { agent } = await criarUsuarioLogado();
    const cat = await criarCategoria(agent, 'Lazer', 100);

    const casos = [
      despesa(cat.id, { valor: 0 }),
      despesa(cat.id, { valor: -5 }),
      despesa(cat.id, { valor: 'abc' }),
      despesa(cat.id, { data: '2026-02-31' }),
      despesa(cat.id, { data: '01/10/2026' }),
      despesa(cat.id, { descricao: '   ' }),
    ];
    for (const corpo of casos) {
      const r = await agent.post('/api/expenses').send(corpo);
      expect(r.status).toBe(400);
    }
  });

  test('despesa de outro mês não entra no mês atual', async () => {
    const { agent } = await criarUsuarioLogado();
    const cat = await criarCategoria(agent, 'Lazer', 100);
    const anterior = mesAnterior();

    await agent.post('/api/expenses').send(despesa(cat.id, { data: anterior.data }));

    const atual = await agent.get('/api/expenses');
    expect(atual.body.despesas).toHaveLength(0);

    const passado = await agent.get(`/api/expenses?mes=${anterior.mes}&ano=${anterior.ano}`);
    expect(passado.body.despesas).toHaveLength(1);
  });
});

describe('Dashboard, alertas e chatbot', () => {
  let agent;

  beforeAll(async () => {
    ({ agent } = await criarUsuarioLogado());
    await agent.post('/api/income').send({ valor: 3000 });
    const alimentacao = await criarCategoria(agent, 'Alimentação', 800);
    const lazer = await criarCategoria(agent, 'Lazer', 200);
    await agent.post('/api/expenses').send(despesa(alimentacao.id, { descricao: 'Mercado', valor: 250 }));
    await agent.post('/api/expenses').send(despesa(lazer.id, { descricao: 'Cinema', valor: 250 }));
  });

  test('calcula renda, total gasto, saldo e percentual', async () => {
    const { body } = await agent.get('/api/dashboard');
    expect(body.resumo.renda).toBe(3000);
    expect(body.resumo.totalGasto).toBe(500);
    expect(body.resumo.saldo).toBe(2500);
    expect(body.resumo.percentualRendaUsada).toBe(16.7);
  });

  test('compara gasto com limite e aponta categoria ultrapassada', async () => {
    const { resumo } = (await agent.get('/api/dashboard')).body;
    const alimentacao = resumo.categorias.find((c) => c.nome === 'Alimentação');
    const lazer = resumo.categorias.find((c) => c.nome === 'Lazer');

    expect(alimentacao.ultrapassou).toBe(false);
    expect(alimentacao.restante).toBe(550);
    expect(alimentacao.percentualUsado).toBeCloseTo(31.3, 1);
    expect(lazer.ultrapassou).toBe(true);
    expect(resumo.categoriasUltrapassadas.map((c) => c.nome)).toEqual(['Lazer']);
  });

  test('gera alerta de limite ultrapassado em Lazer', async () => {
    const { alertas } = (await agent.get('/api/alerts')).body;
    const alerta = alertas.find((a) => a.titulo === 'Lazer: limite ultrapassado');
    expect(alerta).toBeDefined();
    expect(alerta.nivel).toBe('perigo');
  });

  test('chatbot lista as 6 opções', async () => {
    const { body } = await agent.get('/api/chatbot');
    expect(body.opcoes).toHaveLength(6);
  });

  test('chatbot responde o saldo com os mesmos números do dashboard', async () => {
    const { body } = await agent.get('/api/chatbot/saldo');
    expect(body.resposta[0]).toMatch(/Você possui .*2\.500,00 disponíveis neste mês\./);
  });

  test('chatbot lista os gastos e as categorias', async () => {
    const gastos = await agent.get('/api/chatbot/gastos');
    expect(gastos.body.resposta.join('\n')).toContain('Mercado');

    const categorias = await agent.get('/api/chatbot/categorias');
    expect(categorias.body.resposta.join('\n')).toContain('excedeu');
  });

  test('chatbot recusa opção desconhecida', async () => {
    const r = await agent.get('/api/chatbot/xyz');
    expect(r.status).toBe(404);
  });
});

describe('Isolamento entre usuários', () => {
  test('um usuário não vê, edita nem apaga os dados do outro', async () => {
    const a = await criarUsuarioLogado('Usuária A');
    const b = await criarUsuarioLogado('Usuário B');

    await a.agent.post('/api/income').send({ valor: 5000 });
    const catA = await criarCategoria(a.agent, 'Privada', 100);
    const despA = (await a.agent.post('/api/expenses').send(despesa(catA.id))).body.despesa;

    // B não enxerga nada de A
    expect((await b.agent.get('/api/categories')).body.categorias).toHaveLength(0);
    expect((await b.agent.get('/api/expenses')).body.despesas).toHaveLength(0);
    expect((await b.agent.get('/api/income')).body.renda.valor).toBeNull();
    expect((await b.agent.get('/api/dashboard')).body.resumo.totalGasto).toBe(0);

    // B não consegue alterar nem apagar por ID
    expect((await b.agent.put(`/api/categories/${catA.id}`).send({ nome: 'x', limite: 1 })).status).toBe(404);
    expect((await b.agent.delete(`/api/categories/${catA.id}`)).status).toBe(404);
    expect((await b.agent.put(`/api/expenses/${despA.id}`).send(despesa(catA.id))).status).toBe(404);
    expect((await b.agent.delete(`/api/expenses/${despA.id}`)).status).toBe(404);

    // B não consegue lançar despesa na categoria de A
    const roubo = await b.agent.post('/api/expenses').send(despesa(catA.id));
    expect(roubo.status).toBe(400);

    // O chatbot de B também não mostra os dados de A
    const saldoB = await b.agent.get('/api/chatbot/saldo');
    expect(saldoB.body.resposta[0]).toContain('não informou a renda');

    // Tudo de A continua intacto
    expect((await a.agent.get('/api/expenses')).body.despesas).toHaveLength(1);
  });
});