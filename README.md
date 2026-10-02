# Sistema de Gerenciamento e Organização Financeira Pessoal

Projeto acadêmico. O usuário informa a renda do mês, define limites por categoria,
registra despesas e acompanha o saldo, os alertas e um assistente (chatbot por regras).

## Funcionalidades
- Cadastro, login e logout (senha com hash, sessão por cookie httpOnly)
- Renda mensal e categorias com limite
- Despesas (criar, editar, apagar) com data e categoria
- Dashboard: renda, total gasto, saldo, % da renda usada, planejado x realizado
- Alertas: limite ultrapassado, perto do limite, saldo baixo/negativo, renda comprometida
- Chatbot por opções clicáveis
- Navegação entre meses

## Stack
HTML, CSS e JavaScript (frontend) · Node.js + Express (API REST) · SQLite (better-sqlite3)
bcryptjs (hash) · jsonwebtoken (sessão)

## Arquitetura
Usuário → Frontend → Rotas → Controllers → Services (regras de negócio) → SQLite

```
backend/src/   routes/ controllers/ services/ middleware/ database/ utils/
frontend/      login.html dashboard.html css/ js/
database/      financeiro.db (criado automaticamente)
```

## Como executar
Requisitos: Node.js 18+ e Git.

```bash
cd backend
npm install
```
Crie `backend/.env`:
```
PORT=3000
JWT_SECRET=uma_frase_longa_e_aleatoria
```
Inicie:
```bash
npm run dev
```
Acesse http://localhost:3000

## Endpoints (todos, exceto register/login/logout, exigem login)
| Método | Rota | Descrição |
|---|---|---|
| POST | /api/auth/register | Criar conta |
| POST | /api/auth/login | Login |
| POST | /api/auth/logout | Logout |
| GET | /api/user | Usuário logado |
| GET, POST | /api/income | Consultar / definir renda do mês |
| GET, POST | /api/categories | Listar / criar categorias |
| POST | /api/categories/defaults | Criar as 7 categorias padrão |
| PUT, DELETE | /api/categories/:id | Editar / apagar categoria |
| GET, POST | /api/expenses | Listar / criar despesas |
| PUT, DELETE | /api/expenses/:id | Editar / apagar despesa |
| GET | /api/dashboard | Resumo do mês |
| GET | /api/alerts | Alertas do mês |
| GET | /api/chatbot | Saudação e opções |
| GET | /api/chatbot/:option | Resposta do chatbot |

Rotas de dados aceitam `?mes=MM&ano=AAAA` (padrão: mês atual).

## Regras de negócio
- Uma renda por usuário por mês
- Nome de categoria único por usuário
- Categoria com despesas não pode ser apagada
- Valores não negativos; despesa maior que zero
- Saldo = renda − despesas do mês
- Categoria estourada quando gasto > limite
- Alertas: categoria com 80% ou mais do limite; saldo restante de 10% ou menos da renda;
  80% ou mais da renda usada; limites somando mais que a renda

## Segurança
Senhas com bcrypt · cookie httpOnly (secure em produção) · SQL parametrizado ·
`usuario_id` em todas as consultas · validação no backend · saída com `textContent` (XSS)

## Limitações conhecidas
Sem recuperação de senha, 2FA ou login social. Sem limite de tentativas de login.
SQLite e execução local; hospedagem exigiria disco persistente ou PostgreSQL.