# Deploy Checklist (Render + Vercel)

Backends/URLs informados:

- Backend (Render): https://clinic-system-swzd.onrender.com
- Frontend (Vercel): http://clinic-system-five.vercel.app/

## 1) Backend (Render)

- Start command:
  - `gunicorn clinic_project.wsgi --chdir backend --bind 0.0.0.0:10000 --workers 2`
- Env vars obrigatórias:
  - `DEBUG=false`
  - `DJANGO_SECRET_KEY=<segredo forte e longo>`
  - `DJANGO_ALLOWED_HOSTS=clinic-system-swzd.onrender.com,seu-dominio.com`
  - `CORS_ALLOWED_ORIGINS=https://clinic-system-five.vercel.app,https://seu-dominio.com`
  - `CSRF_TRUSTED_ORIGINS=https://clinic-system-five.vercel.app,https://seu-dominio.com` (se usar cookies/admin)
  - `DB_ENGINE=django.db.backends.postgresql`
  - `DB_NAME=<...>` `DB_USER=<...>` `DB_PASSWORD=<...>` `DB_HOST=<...>` `DB_PORT=<...>`
  - `APP_VERSION=v2025.10.08` (opcional)
- Pós-deploy:
  - Rodar migrações (Render → Shell/Deploy Hook): `python backend/manage.py migrate --noinput`
  - Verificar `/healthz` e `/health/full`
  - Conferir cabeçalho `X-App-Version`

## 2) Frontend (Vercel)

- Env vars:
  - `VITE_API_BASE=https://clinic-system-swzd.onrender.com`
- Build/Output
  - `npm ci && npm run build`
  - `dist/` publicado (vercel.json já cobre rewrites e caching)
- PWA ícones
  - Fonte SVG: `frontend/public/icons/clinic-icon.svg`
  - Exportar PNGs se necessário (iOS):
    - `frontend/public/icons/clinic-icon-192.png`
    - `frontend/public/icons/clinic-icon-512.png`
    - `frontend/public/icons/clinic-icon-maskable-512.png`

## 3) Smoke tests pós-deploy

- Login por código (request-code e verify-code)
- Agendamento rápido (criar/editar)
- Finalizar atendimento (inclui caminho "too early" + force-adjust)
- Modais: Detalhes do atendimento (foto, cabeçalho), Client View (foto)
- Agendas: Daily/Semanal/Mensal navegando por dias/semanas
- API de tempo/saúde: `/health/full`
- Sem erros nos consoles do navegador/Render Events

## 4) Banco de dados

- Migrar sem alterações destrutivas (apenas índices/ajustes)
- Conferir contagens básicas (clientes, atendimentos) e leitura/gravação de fotos (MEDIA)

## 5) Monitoramento (24–48h)

- Render Events (erros 4xx/5xx, latência)
- Logs de autenticação e sessões de dispositivos
- Feedback de usuários (fotos carregando, modais, agenda)

## 6) Limpeza de branches (após estabilidade)

- Remover branches mergeadas/stale (local e remoto)
- Opcional: tag `archive/<nome>` antes de apagar

## 7) Mini manual WhatsApp (após monitorar)

- Conteúdo: Login, Buscar cliente, Agendar/Editar, Finalizar, Detalhes
- Formato: texto + 6–8 capturas leves; PDF compacto para envio
