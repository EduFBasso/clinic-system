# Migração para macOS (dev no Mac) — Guia prático

Este guia ajuda a levar o projeto para um Mac (incluindo Apple Silicon M‑series), configurar ferramentas, manter produtividade com VS Code + Copilot, e criar um backup rápido em CSV de clientes.

## 1) Software essencial

- App Store
  - Xcode (se for desenvolver iOS nativo mais adiante)
- Linha de comando
  - Homebrew: https://brew.sh
  - Git: `brew install git`
  - Python (recomendado uv ou pyenv): `brew install uv` (ou `brew install pyenv`)
  - Node.js (mise/nvm): `brew install mise` (ou `brew install nvm`)
  - Docker Desktop for Mac (opcional, se for usar containers)
- Editor
  - VS Code (universal)
  - Extensões: GitHub Copilot, Copilot Chat, Python, ESLint, Prettier

## 2) Github Copilot no Mac (VS Code)

- Instale “GitHub Copilot” e “GitHub Copilot Chat” pelo Marketplace.
- Faça login (GitHub) em VS Code.
- Ative o Copilot para o workspace (Settings → Copilot). Chat funciona igual ao Windows.

## 3) Clonar e abrir o projeto

```bash
# Terminal do macOS (zsh)
mkdir -p ~/dev && cd ~/dev
# clone via SSH (recomendado) ou HTTPS
# gere uma SSH key: ssh-keygen -t ed25519
# adicione em github.com/settings/keys

git clone git@github.com:EduFBasso/clinic-system.git
cd clinic-system
```

## 4) Backend (Django) no macOS

Usando uv (rápido):

```bash
uv venv .venv
source .venv/bin/activate
uv pip install -r requirements.txt
# SQLite local ou Postgres se preferir
cd backend
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

Variáveis úteis (opcionais):

- `DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,<IP_LAN>`
- `CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://<IP_LAN>:5173`

## 5) Frontend (Vite/React) no macOS

```bash
cd frontend
# Node: via mise → `mise use -g node@lts`  (ou nvm)
npm ci --no-audit --no-fund
npm run dev   # porta 5173
```

Acesso no iPhone da mesma rede: `http://<IP_do_Mac>:5173`.

## 6) Scripts e diferenças do Windows

- Scripts PowerShell (\*.ps1) não rodam no macOS. Prefira:
  - Bash/zsh scripts (`.sh`) ou
  - Node scripts (`.mjs`/`.js`) para portabilidade.
- Tasks do VS Code podem chamar os mesmos `npm run` e `python manage.py` em qualquer SO.

## 7) Backup em CSV dos clientes (Django command)

Adicionamos um comando de management para exportar clientes em CSV (exclui foto):

```bash
# Dentro de backend/
python manage.py export_clients_csv --out ../scripts/db/clients-$(date +%Y%m%d).csv
# Ou filtrar por profissional
python manage.py export_clients_csv --professional profissional@dominio.com --out ../scripts/db/clients-$(date +%Y%m%d).csv
```

Campos: id, first_name, last_name, phone, email, date_of_birth, profession, address, address_number, neighborhood, city, state, postal_code, created_at.

Dica: mantenha uma rotina semanal/mensal de export.

## 8) WhatsApp/Orçamentos e acesso pelo iPhone

- A build local já usa `api.whatsapp.com` para abrir o app com texto e/ou número do cliente.
- Teste direto no iPhone usando o IP do Mac.

## 9) Roadmap para iOS nativo (SwiftUI) – opcional

- Xcode + SwiftUI (iOS 16+)
- Auth com token no Keychain + Face ID (LocalAuthentication)
- API do backend (Django/DRF) como fonte de verdade
- Core Data para cache offline; CloudKit opcional para preferências do usuário (evitar dados clínicos no iCloud)

## 10) Integração com IA (assistente de agendamento)

- A IA interpreta pedidos (“amanhã de manhã com a Dra. Ana”), mas quem decide horários é o backend via `/agenda/availability`.
- Comece com chat no web/app; voz depois (Web Speech / Azure Speech).

## 11) Odoo, Chronos e outros repositórios

- Estratégia de migração igual: clonar no `~/dev`, configurar venv/node conforme cada projeto.
- Para Odoo via Docker: usar Docker Desktop for Mac e `docker compose` equivalente.
- Para projetos Python, prefira `uv`/`pyenv`; para Node, `mise`/`nvm`.

## 12) Dicas de produtividade no Mac

- Safari iOS Web Inspector: depure o site no iPhone conectando via cabo (Develop menu).
- Atalhos VS Code iguais; configure `Command` como “Ctrl” se preferir.
- Use `pbcopy`/`pbpaste` para clipboard no terminal.

---

Checklist rápido

- [ ] Git/SSH configurados
- [ ] Python venv (uv) + `pip install -r requirements.txt`
- [ ] `python manage.py migrate` e `runserver`
- [ ] `npm ci` e `npm run dev`
- [ ] Teste no iPhone via IP do Mac
- [ ] Exportação CSV de clientes agendada
- [ ] Decisão sobre iOS nativo/assistente IA (próximos passos)
