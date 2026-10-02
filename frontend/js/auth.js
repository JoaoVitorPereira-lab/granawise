const formLogin = document.getElementById('form-login');
const formRegister = document.getElementById('form-register');
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const mensagem = document.getElementById('mensagem');

function mostrarAba(login) {
  formLogin.classList.toggle('hidden', !login);
  formRegister.classList.toggle('hidden', login);
  tabLogin.classList.toggle('active', login);
  tabRegister.classList.toggle('active', !login);
  mensagem.textContent = '';
}
tabLogin.onclick = () => mostrarAba(true);
tabRegister.onclick = () => mostrarAba(false);

async function enviar(url, dados) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  });
  const json = await resp.json();
  if (!resp.ok) throw new Error(json.erro || 'Erro inesperado.');
  return json;
}

formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await enviar('/api/auth/login', {
      email: document.getElementById('login-email').value,
      senha: document.getElementById('login-senha').value,
    });
    window.location.href = 'dashboard.html';
  } catch (err) { mensagem.textContent = err.message; }
});

formRegister.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await enviar('/api/auth/register', {
      nome: document.getElementById('reg-nome').value,
      email: document.getElementById('reg-email').value,
      senha: document.getElementById('reg-senha').value,
    });
    window.location.href = 'dashboard.html';
  } catch (err) { mensagem.textContent = err.message; }
});

// Se já estiver logado, vai direto para o dashboard
fetch('/api/user').then((r) => { if (r.ok) window.location.href = 'dashboard.html'; });