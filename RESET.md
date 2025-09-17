# Reset do projeto (backend + frontend)

Este guia reverte o ambiente para um baseline estável (branch `main`) e prepara backend e frontend para retomada do trabalho do zero.

## 1) Salve seu WIP (opcional)

Caso esteja em um branch de feature com mudanças locais, crie um branch de backup:

- Já foi criado automaticamente um branch `backup/wip-consultation-core-YYYYMMDD-HHMM` com todos os seus edits.

## 2) Trocar para baseline estável

- Troque para `main` e sincronize:
  - Já foi efetuado: `git switch main` e `git pull --ff-only`.

## 3) Banco de dados local (Docker Postgres)

- Suba o banco local:
  - `docker compose -f docker-compose.local.yml up -d db`
- Credenciais default (veja `docker-compose.local.yml`):
  - host: 127.0.0.1
  - port: 55432 (mapeia para 5432 dentro do container)
  - db: clinic_local
  - user: clinic
  - pass: clinicpass

Restaurar um dump (opcional):

- `.dump` (custom): `pg_restore -h 127.0.0.1 -p 55432 -U clinic -d clinic_local --clean --if-exists backup-file.dump`
- `.sql.gz`: `gzip -dc backup-file.sql.gz | psql -h 127.0.0.1 -p 55432 -U clinic -d clinic_local`

## 4) Backend

- Copie `.env.example` para `.env` ou use o `.env` já criado com defaults locais.
- Instale deps: `python -m pip install -r backend/requirements.txt`
- Migrações: `python backend/manage.py migrate`
- Rodar: `python backend/manage.py runserver` (http://localhost:8000)
- Saúde rápida: `pytest backend/tests/test_health_endpoints.py -q` (ou `backend/tests` completos)

## 5) Frontend

- O arquivo `frontend/.env.development.local` aponta para `http://localhost:8000`.
- Instale deps: `cd frontend` e `npm install`
- Dev server: `npm run dev` (se a porta 5173 estiver ocupada, feche processo ou use `--port 5174`)
- Build/typecheck: `npm run build`

## 6) Variáveis importantes

Backend (`backend/.env`):

- DJANGO_SECRET_KEY (obrigatório em produção; em dev pode usar um valor qualquer)
- DB\_\* (ver seção Banco de dados)
- EMAIL\_\* (em dev usamos por padrão backend de console)

Frontend (`frontend/.env.development*`):

- VITE_API_BASE=http://localhost:8000

## 7) Dicas Windows/PowerShell

- Use caminhos absolutos quando scripts falharem devido ao diretório atual.
- Se tiver PostgreSQL nativo no Windows ocupando 5432, mantenha o Docker na porta 55432 (já configurado).

## 8) Próximos passos

- A partir deste baseline, recrie o app `consultation` e a lógica com mais cuidado (modelos, services, endpoints, UI).
- Abra issues/tarefas pequenas e valide por testes (pytest e vitest) a cada iteração.

---

Este documento é um atalho. Para detalhes, veja `backend/README.md` e `scripts/db/README.md`.
