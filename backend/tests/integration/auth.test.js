const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/database/db');
const { criarUsuarioLogado } = require('../helpers');

describe('Cadastro', () => {
  test('cria conta, devolve cookie e não expõe o hash', async () => {
    const resp = await request(app)
      .post('/api/auth/register')
      .send({ nome: 'Ana', email: 'ana@teste.com', senha: '123456' });

    expect(resp.status).toBe(201);
    expect(resp.body.usuario.email).toBe('ana@teste.com');
    expect(resp.body.usuario.senha_hash).toBeUndefined();
    expect(resp.headers['set-cookie'].join(';')).toContain('HttpOnly');
  });

  test('a senha é salva como hash bcrypt, nunca em texto puro', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ nome: 'Bia', email: 'bia@teste.com', senha: 'minhaSenha123' });

    const { senha_hash } = db.prepare('SELECT senha_hash FROM usuarios WHERE email = ?').get('bia@teste.com');
    expect(senha_hash).not.toBe('minhaSenha123');
    expect(senha_hash).toMatch(/^\$2[aby]\$10\$/);
  });

  test('recusa e-mail duplicado, mesmo com maiúsculas', async () => {
    await request(app).post('/api/auth/register')
      .send({ nome: 'Caio', email: 'caio@teste.com', senha: '123456' });
    const resp = await request(app).post('/api/auth/register')
      .send({ nome: 'Caio 2', email: 'CAIO@teste.com', senha: '123456' });
    expect(resp.status).toBe(409);
  });

  test('recusa senha curta, e-mail inválido e campos vazios', async () => {
    const curta = await request(app).post('/api/auth/register')
      .send({ nome: 'Dani', email: 'dani@teste.com', senha: '123' });
    expect(curta.status).toBe(400);

    const invalido = await request(app).post('/api/auth/register')
      .send({ nome: 'Dani', email: 'isso-nao-e-email', senha: '123456' });
    expect(invalido.status).toBe(400);

    const vazio = await request(app).post('/api/auth/register').send({});
    expect(vazio.status).toBe(400);
  });
});

describe('Login e sessão', () => {
  test('login correto autentica', async () => {
    const { email } = await criarUsuarioLogado();
    const resp = await request(app).post('/api/auth/login').send({ email, senha: '123456' });
    expect(resp.status).toBe(200);
    expect(resp.headers['set-cookie']).toBeDefined();
  });

  test('senha errada e e-mail inexistente dão a mesma resposta genérica', async () => {
    const { email } = await criarUsuarioLogado();
    const senhaErrada = await request(app).post('/api/auth/login').send({ email, senha: 'errada' });
    const emailInexistente = await request(app).post('/api/auth/login')
      .send({ email: 'ninguem@teste.com', senha: '123456' });

    expect(senhaErrada.status).toBe(401);
    expect(emailInexistente.status).toBe(401);
    expect(senhaErrada.body.erro).toBe(emailInexistente.body.erro);
  });

  test('tentativa de SQL Injection no login não autentica', async () => {
    const resp = await request(app).post('/api/auth/login')
      .send({ email: "' OR '1'='1", senha: "' OR '1'='1" });
    expect(resp.status).toBe(401);
  });

  test('rota protegida sem login retorna 401', async () => {
    const resp = await request(app).get('/api/user');
    expect(resp.status).toBe(401);
  });

  test('token adulterado é recusado', async () => {
    const resp = await request(app).get('/api/user').set('Cookie', 'token=abc.def.ghi');
    expect(resp.status).toBe(401);
  });

  test('logado acessa /api/user; depois do logout, não acessa mais', async () => {
    const { agent, email } = await criarUsuarioLogado();

    const logado = await agent.get('/api/user');
    expect(logado.status).toBe(200);
    expect(logado.body.usuario.email).toBe(email);

    await agent.post('/api/auth/logout');
    const depois = await agent.get('/api/user');
    expect(depois.status).toBe(401);
  });
});

describe('Limite de tentativas de login', () => {
  test('bloqueia após 5 senhas erradas, mesmo com a senha certa', async () => {
    const { email } = await criarUsuarioLogado();

    for (let i = 0; i < 5; i++) {
      const r = await request(app).post('/api/auth/login').send({ email, senha: 'errada' });
      expect(r.status).toBe(401);
    }

    const bloqueada = await request(app).post('/api/auth/login').send({ email, senha: 'errada' });
    expect(bloqueada.status).toBe(429);

    const certa = await request(app).post('/api/auth/login').send({ email, senha: '123456' });
    expect(certa.status).toBe(429);
  });

  test('login correto zera o contador de falhas', async () => {
    const { email } = await criarUsuarioLogado();

    for (let i = 0; i < 4; i++) {
      await request(app).post('/api/auth/login').send({ email, senha: 'errada' });
    }
    const ok = await request(app).post('/api/auth/login').send({ email, senha: '123456' });
    expect(ok.status).toBe(200);

    for (let i = 0; i < 4; i++) {
      const r = await request(app).post('/api/auth/login').send({ email, senha: 'errada' });
      expect(r.status).toBe(401); // sem 429: o contador recomeçou
    }
  });
});