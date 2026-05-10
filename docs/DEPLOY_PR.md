# Deploy PR: clinic-system

Resumo do release

- UI/UX de modais padronizada (headers, scroll/viewport fix)
- Tradução PT-BR em “Detalhes do atendimento” e botões
- Foto do cliente nos modais (preferência por `client_photo` e fallback de busca)
- Correções no QuickScheduleModal (construção de horários robusta)
- Melhoria em CORS (headers permitidos e cache de preflight)
- Middleware reordenado (Security → WhiteNoise → Session → CORS → Common → CSRF → Auth)
- Migrações adicionais (não destrutivas; ajustes/índices)
- Roteamento de `/media/` mantido ativo no backend para ambientes online
- Bloqueio opcional de `PUT/PATCH/DELETE` para ambiente online protegido

Ambientes

- Backend (Render): https://clinic-system-swzd.onrender.com
- Frontend (Vercel): http://clinic-system-five.vercel.app/

Variáveis de ambiente (backend/Render)

- DEBUG=false
- DJANGO_SECRET_KEY=<segredo forte e longo>
- DJANGO_ALLOWED_HOSTS=clinic-system-swzd.onrender.com,seu-dominio.com
- CORS_ALLOWED_ORIGINS=https://clinic-system-five.vercel.app,https://seu-dominio.com
- CSRF_TRUSTED_ORIGINS=https://clinic-system-five.vercel.app,https://seu-dominio.com
- DB_ENGINE=django.db.backends.postgresql
- DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT
- APP_VERSION=v2025.10.09 (opcional)
- SERVE_MEDIA_FILES=True
- ONLINE_MUTATION_LOCK_ENABLED=True
- ONLINE_MUTATION_LOCK_METHODS=PUT,PATCH,DELETE

Variáveis de ambiente (frontend/Vercel)

- VITE_API_BASE=https://clinic-system-swzd.onrender.com

Comando de start (backend)

- gunicorn clinic_project.wsgi --chdir backend --bind 0.0.0.0:10000 --workers 2

Migrações

- apps/agenda/migrations/0006*rename*\* (rename de índices; sem alteração de dados)
- Após deploy, executar: python backend/manage.py migrate --noinput

Checklist de Smoke Test

- /healthz e /health/full ok; header X-App-Version presente
- Login atual por TOTP ou WebAuthn
- Agendamento rápido (criar/editar)
- Finalizar atendimento (inclui caminho “too early” + force-adjust)
- Modais (Detalhes do atendimento, Client View) com foto e cabeçalho correto
- Agendas (Daily/Semanal/Mensal) navegando por dia/semana

Notas de segurança

- Em produção (DEBUG=false): SSL redirect, HSTS e cookies seguros ativados automaticamente
- CORS configurado para domínios específicos do Vercel/dominio próprio
- Com `ONLINE_MUTATION_LOCK_ENABLED=True`, o servidor continua aceitando `POST`, mas responde `423 Locked` para `PUT/PATCH/DELETE` nas rotas de API
- Para arquivos de foto persistirem no Render, o recomendado continua sendo disco persistente ou storage externo

Monitoramento

- Render Events: erros/latências
- Console do browser: 4xx/5xx
- Feedback de usuários: fotos em modais, fluxo de agenda/finalização
