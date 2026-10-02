const MAX_FALHAS = 5;
const JANELA_MS = 15 * 60 * 1000; // 15 minutos

const falhas = new Map(); // chave -> { total, expiraEm }

// Conta por IP + e-mail, para um usuário não bloquear o outro
function chave(req) {
  const email = String((req.body && req.body.email) || '').trim().toLowerCase();
  return `${req.ip}|${email}`;
}

function limitarLogin(req, res, next) {
  const k = chave(req);
  const registro = falhas.get(k);

  if (registro && registro.expiraEm > Date.now() && registro.total >= MAX_FALHAS) {
    const minutos = Math.ceil((registro.expiraEm - Date.now()) / 60000);
    return res.status(429).json({
      erro: `Muitas tentativas de login. Tente novamente em ${minutos} minuto(s).`,
    });
  }

  // Intercepta a resposta para contar o resultado ANTES de ela ser enviada
  const enviarJson = res.json.bind(res);
  res.json = (corpo) => {
    if (res.statusCode === 401) {
      const atual = falhas.get(k);
      if (!atual || atual.expiraEm <= Date.now()) {
        falhas.set(k, { total: 1, expiraEm: Date.now() + JANELA_MS });
      } else {
        atual.total += 1;
      }
    } else if (res.statusCode < 400) {
      falhas.delete(k); // login correto zera o contador
    }
    return enviarJson(corpo);
  };

  next();
}

function limparFalhas() {
  falhas.clear();
}

module.exports = { limitarLogin, limparFalhas };