## 🚀 Clinic System

Sistema de gestão de clínica médica com autenticação via código e painel de administração para clientes, profissionais e agendamentos.

### ✅ Módulos em desenvolvimento

- 🔐 **Autenticação via código numérico** (simulando envio por WhatsApp)
- 👤 **Login de profissional** com retorno de JWT (access/refresh)
- 👥 **CRUD de clientes** via painel React com rota protegida
- 🧭 **Navegação protegida com React Router**
- 💾 Integração com backend Django REST Framework

### 🧱 Tecnologias

| Camada | Tecnologias |
|--------|-------------|
| Backend | Python, Django, Django REST Framework, SimpleJWT |
| Frontend | React, Vite, TypeScript, Axios, React Router DOM |
| Auth | JWT (access/refresh), código temporário |
| Banco | MySQL |

### 🖥️ Funcionalidades atuais

- Profissional faz login via código
- Recebe `access_token` + `refresh_token`
- Acesso ao painel de clientes com filtro e listagem
- Autorização protegida com `PrivateRoute`

### 🧪 Testes automatizados

Em planejamento:
- Testes de autenticação
- Validação de rotas protegidas
- Testes de listagem e criação de clientes

---

## 🔄 Em andamento

- Criação de profissional via tela protegida
- Salvamento temporário de códigos para testes (`AuthCodeDebug`)
- Integração entre frontend e backend via Axios