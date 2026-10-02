const jwt = require('jsonwebtoken');
const authService = require('../services/authService');

module.exports = function authMiddleware(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ erro: 'Não autenticado.' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const usuario = authService.buscarUsuarioPorId(payload.id);
    if (!usuario) return res.status(401).json({ erro: 'Usuário não encontrado.' });
    req.usuario = usuario; // usado nas próximas etapas para filtrar por usuario_id
    next();
  } catch {
    return res.status(401).json({ erro: 'Sessão inválida ou expirada.' });
  }
};