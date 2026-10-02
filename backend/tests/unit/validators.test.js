const { validarValor, validarId } = require('../../src/utils/validators');

describe('validarValor', () => {
  test('aceita número e texto com vírgula', () => {
    expect(validarValor(1500, 'O valor')).toBe(1500);
    expect(validarValor('1500,50', 'O valor')).toBe(1500.5);
  });

  test('arredonda para 2 casas decimais', () => {
    expect(validarValor(10.126, 'O valor')).toBe(10.13);
  });

  test('rejeita valor negativo', () => {
    expect(() => validarValor(-1, 'O valor')).toThrow('O valor não pode ser negativo.');
  });

  test('rejeita texto, vazio e nulo', () => {
    expect(() => validarValor('abc', 'O valor')).toThrow('inválido');
    expect(() => validarValor('', 'O valor')).toThrow('Informe');
    expect(() => validarValor(null, 'O valor')).toThrow('Informe');
  });

  test('rejeita valor acima do máximo', () => {
    expect(() => validarValor(2e9, 'O valor')).toThrow('acima do máximo');
  });
});

describe('validarId', () => {
  test('aceita inteiro positivo, inclusive como texto', () => {
    expect(validarId('5')).toBe(5);
  });

  test('rejeita zero, negativo, decimal e texto', () => {
    for (const ruim of [0, -1, 1.5, 'abc']) {
      expect(() => validarId(ruim)).toThrow('ID inválido.');
    }
  });
});