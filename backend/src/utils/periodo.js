// Devolve o intervalo [inicio, fim) de um mês, no formato YYYY-MM-DD
function limitesDoMes(mes, ano) {
  const pad = (n) => String(n).padStart(2, '0');
  const inicio = `${ano}-${pad(mes)}-01`;
  const proxMes = mes === 12 ? 1 : mes + 1;
  const proxAno = mes === 12 ? ano + 1 : ano;
  const fim = `${proxAno}-${pad(proxMes)}-01`;
  return { inicio, fim };
}

module.exports = { limitesDoMes };