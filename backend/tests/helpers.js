const request = require('supertest');
const app = require('../src/app');

const pad = (n) => String(n).padStart(2, '0');
let contador = 0;

// Cria uma conta nova e devolve um "agent" que guarda o cookie de login
async function criarUsuarioLogado(nome = 'Teste') {
  const agent = request.agent(app);
  const email = `usuario${Date.now()}_${contador++}@teste.com`;
  const resp = await agent
    .post('/api/auth/register')
    .send({ nome, email, senha: '123456' });
  return { agent, email, usuario: resp.body.usuario };
}

function dataHoje() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function mesAnterior() {
  const d = new Date();
  let mes = d.getMonth(); // 0-11, então já equivale ao mês anterior em base 1
  let ano = d.getFullYear();
  if (mes === 0) { mes = 12; ano--; }
  return { mes, ano, data: `${ano}-${pad(mes)}-15` };
}

module.exports = { criarUsuarioLogado, dataHoje, mesAnterior };