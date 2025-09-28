# Scripts de apoio

Este diretório contém utilitários para desenvolvimento e operações. Foco: ambiente local simples com SQLite e deploy online (Render + Vercel).

## Local (SQLite)

- setup-venv.ps1
  - Cria `.venv` com Python 3.13 e instala dependências do backend.
  - Uso:
    - `powershell -ExecutionPolicy Bypass -File scripts/setup-venv.ps1`
    - Recriar do zero: `powershell -ExecutionPolicy Bypass -File scripts/setup-venv.ps1 -Recreate`

- run-backend-local.ps1
  - Garante `backend/.env` (copia `.env.sqlite.example` se não existir), roda migrações e sobe o servidor com SQLite.
  - Uso: `powershell -ExecutionPolicy Bypass -File scripts/run-backend-local.ps1 -ListenHost 127.0.0.1 -Port 8000`

- run-tests.ps1
  - Executa a suíte de testes do backend com SQLite em memória (já tratado no `settings.py`).
  - Uso: `powershell -ExecutionPolicy Bypass -File scripts/run-tests.ps1`

- run-backend-lan.ps1
  - Sobe o backend escutando em 0.0.0.0 e ajusta `ALLOWED_HOSTS`/`CORS_ALLOWED_ORIGINS` para IPs de LAN.
  - Útil para testar via celular/mesma rede.

- ping-backend.ps1
  - Envia requisições periódicas a um endpoint `/health` para manter instância online (Render) ou medir latência.

- start-dev.ps1
  - Inicia backend e frontend em janelas separadas. Em modo LAN, detecta um IP privado da máquina (ou use `-LanIp`) e configura o frontend com `VITE_API_BASE` apontando para o backend correto.
  - Exemplos:
    - Local (loopback): `powershell -ExecutionPolicy Bypass -File scripts/start-dev.ps1`
    - LAN automática: `powershell -ExecutionPolicy Bypass -File scripts/start-dev.ps1 -LAN`
    - LAN com IP específico: `powershell -ExecutionPolicy Bypass -File scripts/start-dev.ps1 -LAN -LanIp 192.168.0.123`
    - Abrir navegador automaticamente: `... -OpenBrowser`

- local/create-superuser.ps1
  - Cria um superusuário sem prompts (usa `DJANGO_SUPERUSER_PASSWORD`). Campos exigidos pelo modelo customizado são preenchidos por parâmetros.
  - Exemplo: `powershell -ExecutionPolicy Bypass -File scripts/local/create-superuser.ps1 -Email admin@local.test -FirstName Admin -LastName Local -Password 'Admin123!'`
  - Acesse o admin em `http://127.0.0.1:8000/admin/` (ou `http://<SEU_IP_LAN>:8000/admin/` em LAN).

- local/allow-firewall-dev.ps1
  - Cria regras no Firewall do Windows para permitir acesso inbound TCP nas portas do backend e frontend.
  - Útil para testar via LAN em redes com firewall restritivo.
  - Uso: `powershell -ExecutionPolicy Bypass -File scripts/local/allow-firewall-dev.ps1 -BackendPort 8000 -FrontendPort 5173`
  - Para remover depois: `Remove-NetFirewallRule -DisplayName "Clinic Dev *"`

Nota: os scripts na pasta `scripts/local` são específicos de máquina e estão no `.gitignore` para não irem para a branch principal.

## Postgres (local Docker)

- db/backup-local.ps1
  - Faz dump de um banco local (container `clinic-local-db`) para `scripts/db/backups/`.
- docker-init.sql
  - SQL para criar usuário `clinic` e DB `clinic_local` quando for usar Postgres local.

## Dicas
- Em Windows, o alias "python" da Microsoft Store pode atrapalhar. Use sempre o `.venv\\Scripts\\python.exe` ou o launcher `py -3.13`.
- Para alternar para Postgres online (Render), ajuste `backend/.env` (DB_* e `DB_ENGINE`) e defina variáveis no dashboard da Render conforme `info/local-vs-online-workflow.md`.

## Troubleshooting

- Backend não responde em `http://127.0.0.1:8000/health`:
  - Verifique se o processo está rodando: `Get-Process python -ErrorAction SilentlyContinue`
  - Rode o backend manualmente para ver logs:
  - Local: `powershell -ExecutionPolicy Bypass -File scripts/run-backend-local.ps1 -ListenHost 127.0.0.1 -Port 8000`
    - LAN: `powershell -ExecutionPolicy Bypass -File scripts/run-backend-lan.ps1 -Port 8000`
  - Confirme o `.env` do backend: `backend/.env` deve ter `DB_ENGINE=django.db.backends.sqlite3` e `DB_NAME=db.sqlite3` para uso local.
  - Firewall: permita as portas com `scripts/allow-firewall-dev.ps1`.

- Frontend sobe mas não encontra o backend:
  - Veja o valor de `VITE_API_BASE` impresso na janela do frontend ao iniciar.
  - Em LAN, confirme que o IP e porta do backend são acessíveis a partir de outro dispositivo na mesma rede.
  - CORS: `run-backend-lan.ps1` preenche `CORS_ALLOWED_ORIGINS` com `http://<IP_LAN>:5173`.

- Superusuário/admin:
  - Use `scripts/create-superuser.ps1` para criar.
  - Login em `/admin/` com o e-mail e senha definidos.
