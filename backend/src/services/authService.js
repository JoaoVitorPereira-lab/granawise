const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const AppError = require('../utils/AppError');

function gerarToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '2h' });
}

function buscarUsuarioPorId(id) {
  return db
    .prepare('SELECT id, nome, email, criado_em FROM usuarios WHERE id = ?')
    .get(id);
}

async function registrar({ nome, email, senha }) {
  nome = (nome || '').trim();
  email = (email || '').trim().toLowerCase();
  senha = senha || '';

  if (!nome || !email || !senha) throw new AppError('Preencha nome, e-mail e senha.');
  if (nome.length > 100) throw new AppError('Nome muito longo.');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new AppError('E-mail inválido.');
  if (senha.length < 6) throw new AppError('A senha deve ter pelo menos 6 caracteres.');

  const existe = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email);
  if (existe) throw new AppError('E-mail já cadastrado.', 409);

  const senhaHash = await bcrypt.hash(senha, 10);
  const { lastInsertRowid } = db
    .prepare('INSERT INTO usuarios (nome, email, senha_hash) VALUES (?, ?, ?)')
    .run(nome, email, senhaHash);

  return { token: gerarToken(lastInsertRowid), usuario: buscarUsuarioPorId(lastInsertRowid) };
}

async function login({ email, senha }) {
  email = (email || '').trim().toLowerCase();
  const user = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);

  // Mesma mensagem para e-mail ou senha incorretos (não revela qual está errado)
  if (!user || !(await bcrypt.compare(senha || '', user.senha_hash))) {
    throw new AppError('E-mail ou senha incorretos.', 401);
  }
  return { token: gerarToken(user.id), usuario: buscarUsuarioPorId(user.id) };
}

module.exports = { registrar, login, buscarUsuarioPorId };