const authService = require('../services/authService');

const cookieOptions = {
  httpOnly: true,               // JavaScript do navegador não lê o cookie
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production', // só envia o cookie por HTTPS em produção
  maxAge: 2 * 60 * 60 * 1000,   // 2 horas
};

async function register(req, res, next) {
  try {
    const { token, usuario } = await authService.registrar(req.body);
    res.cookie('token', token, cookieOptions).status(201).json({ usuario });
  } catch (err) { next(err); }
}

async function login(req, res, next) {
  try {
    const { token, usuario } = await authService.login(req.body);
    res.cookie('token', token, cookieOptions).json({ usuario });
  } catch (err) { next(err); }
}

function logout(req, res) {
  res.clearCookie('token').json({ mensagem: 'Logout realizado.' });
}

module.exports = { register, login, logout };