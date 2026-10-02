const AppError = require('./AppError');

// Aceita número ou texto ("1500.50" ou "1500,50"). Devolve número com 2 casas.
function validarValor(valor, campo, { min = 0, max = 1000000000 } = {}) {
  if (typeof valor === 'string') valor = valor.trim().replace(',', '.');
  if (valor === '' || valor === null || valor === undefined) {
    throw new AppError(`Informe ${campo}.`);
  }
  const n = Number(valor);
  if (!Number.isFinite(n)) throw new AppError(`${campo} inválido.`);
  if (n < min) throw new AppError(`${campo} não pode ser negativo.`);
  if (n > max) throw new AppError(`${campo} acima do máximo permitido.`);
  return Math.round(n * 100) / 100;
}

function validarId(valor) {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) throw new AppError('ID inválido.');
  return id;
}

module.exports = { validarValor, validarId };