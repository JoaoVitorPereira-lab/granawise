const { gerar } = require('../../src/services/alertService');

function resumoBase(sobrescrever = {}) {
  return {
    mes: 10, ano: 2026,
    renda: 1000, totalGasto: 0, totalLimites: 0, saldo: 1000, percentualRendaUsada: 0,
    categorias: [], categoriasUltrapassadas: [], recentes: [],
    ...sobrescrever,
  };
}

function categoria(nome, limite, gasto) {
  return {
    nome, limite, gasto,
    restante: limite - gasto,
    percentualUsado: limite > 0 ? Math.round((gasto / limite) * 1000) / 10 : null,
    ultrapassou: gasto > limite,
  };
}

const titulos = (alertas) => alertas.map((a) => a.titulo);

describe('alertService.gerar', () => {
  test('sem problemas, não gera alertas', () => {
    expect(gerar(resumoBase())).toEqual([]);
  });

  test('renda não informada gera alerta informativo', () => {
    const alertas = gerar(resumoBase({ renda: null, saldo: null, percentualRendaUsada: null }));
    expect(alertas).toHaveLength(1);
    expect(alertas[0]).toMatchObject({ nivel: 'info', titulo: 'Renda não informada' });
  });

  test('saldo negativo é perigo', () => {
    const alertas = gerar(resumoBase({ totalGasto: 1050, saldo: -50, percentualRendaUsada: 105 }));
    expect(alertas).toHaveLength(1);
    expect(alertas[0]).toMatchObject({ nivel: 'perigo', titulo: 'Saldo negativo' });
  });

  test('saldo baixo aparece sozinho, sem duplicar com renda comprometida', () => {
    const alertas = gerar(resumoBase({ totalGasto: 950, saldo: 50, percentualRendaUsada: 95 }));
    expect(titulos(alertas)).toEqual(['Saldo baixo']);
  });

  test('80% ou mais da renda usada gera aviso', () => {
    const alertas = gerar(resumoBase({ totalGasto: 850, saldo: 150, percentualRendaUsada: 85 }));
    expect(titulos(alertas)).toEqual(['Grande parte da renda utilizada']);
  });

  test('limites somando mais que a renda', () => {
    const alertas = gerar(resumoBase({ totalLimites: 1500 }));
    expect(titulos(alertas)).toEqual(['Limites acima da renda']);
  });

  test('categoria acima do limite é perigo', () => {
    const alertas = gerar(resumoBase({ categorias: [categoria('Lazer', 100, 150)] }));
    expect(alertas).toHaveLength(1);
    expect(alertas[0]).toMatchObject({ nivel: 'perigo', titulo: 'Lazer: limite ultrapassado' });
  });

  test('categoria com 83% do limite é aviso', () => {
    const alertas = gerar(resumoBase({ categorias: [categoria('Alimentação', 300, 250)] }));
    expect(alertas[0]).toMatchObject({ nivel: 'aviso', titulo: 'Alimentação: perto do limite' });
  });

  test('exatamente 80% já gera aviso (limite da regra)', () => {
    const alertas = gerar(resumoBase({ categorias: [categoria('Transporte', 100, 80)] }));
    expect(titulos(alertas)).toEqual(['Transporte: perto do limite']);
  });

  test('categoria com 79% não gera alerta', () => {
    const alertas = gerar(resumoBase({ categorias: [categoria('Transporte', 100, 79)] }));
    expect(alertas).toEqual([]);
  });

  test('gasto em categoria sem limite gera aviso, e não "ultrapassado"', () => {
    const alertas = gerar(resumoBase({ categorias: [categoria('Transporte', 0, 50)] }));
    expect(alertas).toHaveLength(1);
    expect(alertas[0]).toMatchObject({ nivel: 'aviso', titulo: 'Transporte: sem limite' });
  });

  test('perigo vem antes de aviso e info', () => {
    const alertas = gerar(resumoBase({
      renda: null, saldo: null, percentualRendaUsada: null,
      categorias: [categoria('Lazer', 100, 150), categoria('Alimentação', 300, 250)],
    }));
    expect(alertas.map((a) => a.nivel)).toEqual(['perigo', 'aviso', 'info']);
  });
});