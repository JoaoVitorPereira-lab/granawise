// Envolvido em uma função para não conflitar com as variáveis do dashboard.js
(function () {
  const caixa = document.getElementById('chat-mensagens');
  const areaOpcoes = document.getElementById('chat-opcoes');

  function adicionar(tipo, linhas) {
    const bolha = document.createElement('div');
    bolha.className = 'bolha ' + tipo;
    for (const linha of linhas) {
      const p = document.createElement('p');
      p.textContent = linha; // textContent evita XSS
      bolha.appendChild(p);
    }
    caixa.appendChild(bolha);
    caixa.scrollTop = caixa.scrollHeight;
  }

  async function pedir(url) {
    const resp = await fetch(url);
    if (resp.status === 401) {
      window.location.href = 'login.html';
      throw new Error('Sessão expirada.');
    }
    const json = await resp.json();
    if (!resp.ok) throw new Error(json.erro || 'Erro inesperado.');
    return json;
  }

  async function escolher(opcao) {
    adicionar('usuario', [opcao.rotulo]);
    try {
      const { resposta } = await pedir(`/api/chatbot/${opcao.id}?mes=${MES}&ano=${ANO}`);
      adicionar('bot', resposta);
    } catch (err) {
      adicionar('bot', [err.message]);
    }
  }

  (async () => {
    try {
      const { saudacao, opcoes } = await pedir('/api/chatbot');
      adicionar('bot', [saudacao]);
      for (const opcao of opcoes) {
        const botao = document.createElement('button');
        botao.type = 'button';
        botao.className = 'opcao-chat';
        botao.textContent = opcao.rotulo;
        botao.onclick = () => escolher(opcao);
        areaOpcoes.appendChild(botao);
      }
    } catch (err) {
      adicionar('bot', [err.message]);
    }
  })();
})();