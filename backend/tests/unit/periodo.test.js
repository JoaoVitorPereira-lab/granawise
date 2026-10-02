const { limitesDoMes } = require('../../src/utils/periodo');
const { resolverPeriodo } = require('../../src/services/incomeService');

describe('limitesDoMes', () => {
  test('mês comum', () => {
    expect(limitesDoMes(3, 2026)).toEqual({ inicio: '2026-03-01', fim: '2026-04-01' });
  });

  test('dezembro vira janeiro do ano seguinte', () => {
    expect(limitesDoMes(12, 2026)).toEqual({ inicio: '2026-12-01', fim: '2027-01-01' });
  });
});

describe('resolverPeriodo', () => {
  test('converte texto em número', () => {
    expect(resolverPeriodo({ mes: '5', ano: '2026' })).toEqual({ mes: 5, ano: 2026 });
  });

  test('sem parâmetros usa o mês e o ano atuais', () => {
    const hoje = new Date();
    expect(resolverPeriodo({})).toEqual({ mes: hoje.getMonth() + 1, ano: hoje.getFullYear() });
  });

  test('rejeita mês e ano inválidos', () => {
    expect(() => resolverPeriodo({ mes: 13 })).toThrow('Mês inválido.');
    expect(() => resolverPeriodo({ mes: 0 })).toThrow('Mês inválido.');
    expect(() => resolverPeriodo({ ano: 1999 })).toThrow('Ano inválido.');
  });
});