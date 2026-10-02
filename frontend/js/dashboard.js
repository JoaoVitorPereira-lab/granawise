const hoje = new Date();
let MES = hoje.getMonth() + 1;
let ANO = hoje.getFullYear();
const NOMES_MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, '0');

let resumo = null;      // dados de /api/dashboard
let categorias = [];    // dados de /api/categories
let despesas = [];      // dados de /api/expenses
let rendaAtual = null;
let alertas = [];

async function api(url, opcoes = {}) {
  const resp = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opcoes,
  });
  if (resp.status === 401) {
    window.location.href = 'login.html';
    throw new Error('Sessão expirada.');
  }
  const json = await resp.json();
  if (!resp.ok) throw new Error(json.erro || 'Erro inesperado.');
  return json;
}

function mostrarAviso(texto, erro = true) {
  const el = $('aviso');
  el.textContent = texto;
  el.className = 'aviso ' + (texto ? (erro ? 'erro' : 'ok') : '');
}

function criarBotao(texto, classe, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = texto;
  b.className = classe;
  b.onclick = onClick;
  return b;
}

function celula(texto) {
  const td = document.createElement('td');
  td.textContent = texto; // textContent evita XSS
  return td;
}

function formatarData(iso) {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

// ---------- Carregamento ----------
let reqId = 0;

async function recarregar() {
  const meu = ++reqId;
  const [cats, desp, painel, alts] = await Promise.all([
    api('/api/categories'),
    api(`/api/expenses?mes=${MES}&ano=${ANO}`),
    api(`/api/dashboard?mes=${MES}&ano=${ANO}`),
    api(`/api/alerts?mes=${MES}&ano=${ANO}`),
  ]);
  if (meu !== reqId) return; // chegou uma navegação mais nova, descarta esta resposta
  categorias = cats.categorias;
  despesas = desp.despesas;
  resumo = painel.resumo;
  alertas = alts.alertas;
  rendaAtual = resumo.renda;
  renderizarTudo();
}

function renderizarTudo() {
  renderizarCartoes();
  renderizarAlertas();
  renderizarComparativo();
  renderizarDespesas();
  renderizarSelectCategorias();
  renderizarCategorias();
  $('renda-atual').textContent = rendaAtual === null ? 'não informada' : brl.format(rendaAtual);
  $('renda-valor').value = rendaAtual !== null ? rendaAtual : '';
}

// ---------- Cartões e comparativo ----------
function renderizarCartoes() {
  $('card-renda').textContent = resumo.renda === null ? 'não informada' : brl.format(resumo.renda);
  $('card-gasto').textContent = brl.format(resumo.totalGasto);
  $('card-saldo').textContent = resumo.saldo === null ? '-' : brl.format(resumo.saldo);
  $('card-saldo').className = resumo.saldo !== null && resumo.saldo < 0 ? 'negativo' : '';
  $('card-percentual').textContent =
    resumo.percentualRendaUsada === null ? '-' : resumo.percentualRendaUsada.toFixed(1) + '%';
}

function renderizarAlertas() {
  const lista = $('lista-alertas');
  lista.innerHTML = '';

  if (alertas.length === 0) {
    const li = document.createElement('li');
    li.className = 'alerta ok';
    li.textContent = '✅ Tudo certo por enquanto. Nenhum alerta neste mês.';
    lista.appendChild(li);
    return;
  }

  const icones = { perigo: '🔴', aviso: '🟡', info: '🔵' };
  for (const a of alertas) {
    const li = document.createElement('li');
    li.className = 'alerta ' + a.nivel;
    const titulo = document.createElement('strong');
    titulo.textContent = `${icones[a.nivel]} ${a.titulo}`;
    const msg = document.createElement('span');
    msg.textContent = a.mensagem; // textContent evita XSS
    li.append(titulo, msg);
    lista.appendChild(li);
  }
}

function renderizarComparativo() {
  const area = $('comparativo');
  area.innerHTML = '';
  $('comparativo-vazio').classList.toggle('hidden', resumo.categorias.length > 0);

  for (const c of resumo.categorias) {
    const pct = c.percentualUsado !== null ? c.percentualUsado : (c.ultrapassou ? 100 : 0);
    const situacao = c.ultrapassou ? 'estourou' : pct >= 80 ? 'atencao' : 'ok';

    const item = document.createElement('div');
    item.className = 'item-comparativo';

    const rotulo = document.createElement('div');
    rotulo.className = 'rotulo';
    const nome = document.createElement('strong');
    nome.textContent = c.nome;
    const detalhe = document.createElement('span');
    detalhe.textContent = c.limite > 0
      ? `${brl.format(c.gasto)} de ${brl.format(c.limite)} (${c.percentualUsado.toFixed(1)}%)`
      : `${brl.format(c.gasto)} (sem limite definido)`;
    rotulo.append(nome, detalhe);

    const barra = document.createElement('div');
    barra.className = 'barra';
    const preenchimento = document.createElement('div');
    preenchimento.className = 'preenchimento ' + situacao;
    preenchimento.style.width = Math.min(100, pct) + '%';
    barra.appendChild(preenchimento);

    item.append(rotulo, barra);
    if (c.ultrapassou) {
      const msg = document.createElement('small');
      msg.className = 'negativo';
      msg.textContent = `Limite ultrapassado em ${brl.format(c.gasto - c.limite)}`;
      item.appendChild(msg);
    }
    area.appendChild(item);
  }
}

// ---------- Despesas ----------
function renderizarSelectCategorias() {
  const select = $('desp-categoria');
  const anterior = select.value;
  select.innerHTML = '';

  if (categorias.length === 0) {
    const op = document.createElement('option');
    op.value = '';
    op.textContent = 'Crie uma categoria primeiro';
    select.appendChild(op);
    select.disabled = true;
    return;
  }
  select.disabled = false;
  for (const c of categorias) {
    const op = document.createElement('option');
    op.value = c.id;
    op.textContent = c.nome;
    select.appendChild(op);
  }
  if (anterior) select.value = anterior;
}

function renderizarDespesas() {
  const corpo = $('tabela-despesas');
  corpo.innerHTML = '';
  $('despesas-vazio').classList.toggle('hidden', despesas.length > 0);

  for (const d of despesas) {
    const tr = document.createElement('tr');
    const tdAcoes = document.createElement('td');
    tdAcoes.append(
      criarBotao('Editar', 'pequeno', () => editarDespesa(d)),
      criarBotao('Apagar', 'pequeno perigo', () => apagarDespesa(d)),
    );
    tr.append(celula(formatarData(d.data)), celula(d.descricao), celula(d.categoria),
      celula(brl.format(d.valor)), tdAcoes);
    corpo.appendChild(tr);
  }
}

function ehMesAtual() {
  return MES === hoje.getMonth() + 1 && ANO === hoje.getFullYear();
}

function dataPadrao() {
  const dia = ehMesAtual() ? hoje.getDate() : 1;
  return `${ANO}-${pad(MES)}-${pad(dia)}`;
}

// Atualiza título, limites do campo de data e formulário para o mês selecionado
function aplicarPeriodo() {
  $('periodo').textContent = `Resumo de ${NOMES_MESES[MES - 1]} de ${ANO}`;
  const ultimoDia = new Date(ANO, MES, 0).getDate();
  $('desp-data').min = `${ANO}-${pad(MES)}-01`;
  $('desp-data').max = `${ANO}-${pad(MES)}-${pad(ultimoDia)}`;
  limparFormDespesa(); // também descarta uma edição em andamento
}

async function irPara(mes, ano) {
  if (mes > 12) { mes = 1; ano++; }
  else if (mes < 1) { mes = 12; ano--; }
  if (ano < 2000 || ano > 2100) return;
  MES = mes;
  ANO = ano;
  aplicarPeriodo();
  try {
    await recarregar();
    mostrarAviso('');
  } catch (err) { mostrarAviso(err.message); }
}

$('mes-anterior').onclick = () => irPara(MES - 1, ANO);
$('mes-proximo').onclick = () => irPara(MES + 1, ANO);
$('mes-atual').onclick = () => irPara(hoje.getMonth() + 1, hoje.getFullYear());

function limparFormDespesa() {
  $('form-despesa').reset();
  $('desp-id').value = '';
  $('desp-data').value = dataPadrao();
  $('btn-salvar-desp').textContent = 'Adicionar';
  $('btn-cancelar-desp').classList.add('hidden');
}
$('btn-cancelar-desp').onclick = limparFormDespesa;

function editarDespesa(d) {
  $('desp-id').value = d.id;
  $('desp-descricao').value = d.descricao;
  $('desp-valor').value = d.valor;
  $('desp-data').value = d.data;
  $('desp-categoria').value = d.categoria_id;
  $('btn-salvar-desp').textContent = 'Salvar alterações';
  $('btn-cancelar-desp').classList.remove('hidden');
  $('desp-descricao').focus();
}

$('form-despesa').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('desp-id').value;
  const corpo = JSON.stringify({
    descricao: $('desp-descricao').value,
    valor: $('desp-valor').value,
    data: $('desp-data').value,
    categoria_id: $('desp-categoria').value,
  });
  try {
    if (id) await api(`/api/expenses/${id}`, { method: 'PUT', body: corpo });
    else await api('/api/expenses', { method: 'POST', body: corpo });
    limparFormDespesa();
    await recarregar();
    mostrarAviso(id ? 'Despesa atualizada.' : 'Despesa registrada.', false);
  } catch (err) { mostrarAviso(err.message); }
});

async function apagarDespesa(d) {
  if (!confirm(`Apagar a despesa "${d.descricao}"?`)) return;
  try {
    await api(`/api/expenses/${d.id}`, { method: 'DELETE' });
    await recarregar();
    mostrarAviso('Despesa removida.', false);
  } catch (err) { mostrarAviso(err.message); }
}

// ---------- Renda ----------
$('form-renda').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/api/income', {
      method: 'POST',
      body: JSON.stringify({ valor: $('renda-valor').value, mes: MES, ano: ANO }),
    });
    await recarregar();
    mostrarAviso('Renda salva.', false);
  } catch (err) { mostrarAviso(err.message); }
});

// ---------- Categorias ----------
function renderizarCategorias() {
  const corpo = $('tabela-categorias');
  corpo.innerHTML = '';
  $('vazio').classList.toggle('hidden', categorias.length > 0);

  for (const cat of categorias) {
    const tr = document.createElement('tr');
    const perc = rendaAtual > 0 ? ((cat.limite / rendaAtual) * 100).toFixed(1) + '%' : '-';
    const tdAcoes = document.createElement('td');
    tdAcoes.append(
      criarBotao('Editar', 'pequeno', () => editarCategoria(cat)),
      criarBotao('Apagar', 'pequeno perigo', () => apagarCategoria(cat)),
    );
    tr.append(celula(cat.nome), celula(brl.format(cat.limite)), celula(perc), tdAcoes);
    corpo.appendChild(tr);
  }

  const total = categorias.reduce((soma, c) => soma + c.limite, 0);
  $('total-limites').textContent = brl.format(total);
  const el = $('nao-distribuido');
  if (rendaAtual === null) {
    el.textContent = '-';
    el.className = '';
  } else {
    const sobra = rendaAtual - total;
    el.textContent = brl.format(sobra);
    el.className = sobra < 0 ? 'negativo' : '';
  }
}

function editarCategoria(cat) {
  $('cat-id').value = cat.id;
  $('cat-nome').value = cat.nome;
  $('cat-limite').value = cat.limite;
  $('btn-salvar-cat').textContent = 'Salvar alterações';
  $('btn-cancelar').classList.remove('hidden');
  $('cat-nome').focus();
}

function limparFormCategoria() {
  $('form-categoria').reset();
  $('cat-id').value = '';
  $('btn-salvar-cat').textContent = 'Adicionar';
  $('btn-cancelar').classList.add('hidden');
}
$('btn-cancelar').onclick = limparFormCategoria;

$('form-categoria').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('cat-id').value;
  const corpo = JSON.stringify({ nome: $('cat-nome').value, limite: $('cat-limite').value });
  try {
    if (id) await api(`/api/categories/${id}`, { method: 'PUT', body: corpo });
    else await api('/api/categories', { method: 'POST', body: corpo });
    limparFormCategoria();
    await recarregar();
    mostrarAviso(id ? 'Categoria atualizada.' : 'Categoria criada.', false);
  } catch (err) { mostrarAviso(err.message); }
});

async function apagarCategoria(cat) {
  if (!confirm(`Apagar a categoria "${cat.nome}"?`)) return;
  try {
    await api(`/api/categories/${cat.id}`, { method: 'DELETE' });
    await recarregar();
    mostrarAviso('Categoria removida.', false);
  } catch (err) { mostrarAviso(err.message); }
}

$('btn-padrao').onclick = async () => {
  try {
    await api('/api/categories/defaults', { method: 'POST' });
    await recarregar();
    mostrarAviso('Categorias padrão criadas. Agora defina o limite de cada uma.', false);
  } catch (err) { mostrarAviso(err.message); }
};

// ---------- Início e logout ----------
$('btn-logout').onclick = async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = 'login.html';
};

(async () => {
  try {
    const { usuario } = await api('/api/user');
    $('nome-usuario').textContent = `Olá, ${usuario.nome}`;
    aplicarPeriodo();
    await recarregar();
  } catch (err) { mostrarAviso(err.message); }
})();