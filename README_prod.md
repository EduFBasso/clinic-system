# Guia de Deploy e Operação – Produção

Este arquivo consolida um checklist de verificação para levar o sistema ao ar com estabilidade (Render + Vercel), além de um resumo dos módulos principais e configurações.

## 1) Checklist “Go Live” rápido

- Segurança e config
  - DEBUG=False
  - DJANGO_SECRET_KEY forte (não reutilize chaves de dev)
  - DJANGO_ALLOWED_HOSTS com domínio(s) do backend
  - CORS_ALLOWED_ORIGINS com domínio(s) do frontend
  - CSRF_TRUSTED_ORIGINS se usar admin/CSRF em domínio diferente
  - SECURE_SSL_REDIRECT=True, SESSION_COOKIE_SECURE=True, CSRF_COOKIE_SECURE=True, HSTS ativo (ver seção 3)
  - ALLOW_OTP_FALLBACK=False; MAX_ACTIVE_DEVICE_SESSIONS=2
- Banco e migrações
  - Backup do Postgres (pg_dump)
  - python manage.py check; makemigrations --check --dry-run; migrate (staging);
- Build e deploy
  - Frontend: npm ci; npm run build; verificar sem erros
  - Backend: coletar estáticos (collectstatic) e garantir logs no console
  - Deploy backend (Render) e frontend (Vercel) para staging
- Fumaça em produção/staging
  - Login por OTP (desktop + iPhone)
  - Refresh mantendo sessão
  - Dois dispositivos em paralelo (contagem + limite)
  - Lista → Modal → Fechar no mobile (botão voltar)
  - E-mail de OTP chegando; logs OK no Render
- Observabilidade
  - Conferir logs sem 5xx
  - (Opcional) Sentry/monitoramento e UptimeRobot

## 2) Ambientes e variáveis (Render/Vercel)

Backend (Render – Web Service)

- Ambiente (vars):
  - DEBUG=False
  - DJANGO_SECRET_KEY=<segredo forte>
  - DJANGO_ALLOWED_HOSTS=api.seudominio.com, seu-servico.onrender.com
  - CORS_ALLOWED_ORIGINS=https://app.seudominio.com, https://seu-frontend.vercel.app
  - CSRF_TRUSTED_ORIGINS=https://app.seudominio.com, https://seu-frontend.vercel.app
  - DB_ENGINE=django.db.backends.postgresql
  - DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT
  - EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
  - EMAIL_HOST, EMAIL_PORT, EMAIL_HOST_USER, EMAIL_HOST_PASSWORD, EMAIL_USE_TLS/EMAIL_USE_SSL
  - ALLOW_OTP_FALLBACK=False
  - MAX_ACTIVE_DEVICE_SESSIONS=2
  - TIME_ZONE=America/Sao_Paulo (opcional)
- Build/Start (exemplo):
  - Build: pip install -r requirements.txt; python backend/manage.py collectstatic --noinput
  - Start: gunicorn clinic_project.wsgi --chdir backend --bind 0.0.0.0:10000 --workers 2
  - Observação: ajustar diretórios conforme seu serviço apontar para a pasta backend
- Plano “always on”: recomendado (evita cold start)

Frontend (Vercel)

- Variáveis:
  - VITE_API_BASE_URL=https://api.seudominio.com (ou URL do Render)
- Build: vercel detecta (Vite). Certifique-se que npm run build passa localmente.
- Proteção de branch: o script de build bloqueia deploy de produção a partir de branches diferentes de 'main' (usa VERCEL_ENV==='production' e VERCEL_GIT_COMMIT_REF). Deploy previews continuam ativos para PRs/staging.

## 3) Hardening Django em produção

No settings (ativo quando DEBUG=False):

- SECURE_SSL_REDIRECT=True
- SECURE_PROXY_SSL_HEADER=("HTTP_X_FORWARDED_PROTO", "https")
- SESSION_COOKIE_SECURE=True
- CSRF_COOKIE_SECURE=True
- SECURE_HSTS_SECONDS=31536000
- SECURE_HSTS_INCLUDE_SUBDOMAINS=True
- SECURE_HSTS_PRELOAD=True
- LOGGING: enviar WARNING/ERROR ao stdout (Render captura)
- CONN_MAX_AGE=60–300 (pool simples)

CORS e CSRF:

- Defina CORS_ALLOWED_ORIGINS apenas com domínios confiáveis
- CSRF_TRUSTED_ORIGINS se for usar admin em domínio distinto do backend

## 4) OTP, sessões e autenticidade

- OTP
  - Sempre validar o código mais recente e inválidar anteriores (já implementado)
  - Produção: considerar throttling (ex.: 5/min por IP/e-mail) para evitar abuso
  - SMTP real com SPF/DKIM/DMARC configurados
- Sessões por dispositivo
  - MAX_ACTIVE_DEVICE_SESSIONS=2
  - Ao logar, cria/reativa sessão e conta; ao exceder, derruba a mais antiga
- Tokens
  - Access 10h; Refresh 1d
  - Persistência no localStorage; validação no load e refresh silencioso quando próximo do vencimento

## 5) Fluxo de vida (ativo, sono, retomada)

- Frontend (Vercel): sempre ativo (CDN). Na carga, valida tokens; em focus/online, revalida. Modal mobile fecha por ESC/overlay/botão voltar.
- Backend (Render): se o plano não dormir, sempre pronto. Se dormir (planos gratuitos), primeiro request é mais lento (cold start). Health-check/monitor reduz impacto.
- Banco (Postgres Render): sempre ativo; observe limites de conexão; use CONN_MAX_AGE.

## 6) Testes de fumaça após cada deploy

- Login por OTP (desktop + iPhone)
- Refresh mantendo sessão
- Dois dispositivos ao mesmo tempo (contagem aparece; limite respeitado)
- Listagem de clientes; abrir e fechar modal (inclui botão voltar no mobile)
- Edição rápida de um cliente; validação de erros
- Ver logs (Render) sem exceções recorrentes

## 7) Backup e rollback

- Backup antes de migrações (pg_dump)
- Guardar o tag/commit do release
- Plano de rollback: reverter deploy (Render/Vercel) e restaurar backup caso necessário

## 8) Mapa do sistema (resumo dos módulos)

Backend (Django/DRF)

- Projeto: backend/clinic_project
  - settings.py: configs por ambiente (DEBUG, DB, CORS/CSRF, JWT, e-mail, hardening)
  - urls.py/wsgi.py/asgi.py: roteamento e entrada do servidor
- App: backend/apps/register
  - models.py: Professional (AUTH_USER_MODEL), Client, AccessCode (OTP), DeviceSession
  - views_auth_code.py: endpoints de OTP (solicitar/validar) e logout de dispositivo
  - client_views.py: CRUD/listagem de clientes (endpoints que o frontend consome)
  - professional_views.py: lista restrita de profissionais (exclui superuser)
  - serializers\_\*.py: serialização de dados para a API
  - services/
    - access_code.py: geração e invalidação de códigos OTP
    - otp_service.py: orquestra envio de e-mail
    - notifications.py: envio de e-mails (SMTP)
  - management/commands/
    - import_clients_csv.py: importação via CSV (dedupe global; reatribuição de profissional)
    - import_remote.py: importação via API (opcional)
- Configs adicionais
  - REST_FRAMEWORK: JWT (SimpleJWT)
  - WhiteNoise: servir estáticos em produção

Frontend (React/Vite)

- Config
  - src/config/api.ts: resolve API_BASE; usar VITE_API_BASE_URL em produção (definir na Vercel)
- Hooks
  - useClients.ts, useProfessionals.ts: fetch e estado base
- Componentes
  - NavBar.tsx: fluxo de login por OTP e persistência de tokens
  - MainContent.tsx: listagem, filtro e modal de cliente; integração com botão voltar
  - ClientCard.tsx: cartão com ações rápidas
  - ClientView.tsx: exibição detalhada (modal)
  - ClientForm.tsx / ClientFormDesktop.tsx / ClientFormMobile.tsx: criação/edição
  - SessionExpiredModal.tsx: UX para sessão expirada
- Páginas
  - pages/Home.tsx, pages/Client.tsx, pages/AgendaPage.tsx (futura agenda)
- Estilos
  - src/styles/\* e palette.css

## 9) Dicas operacionais

- Logs
  - Render mostra stdout/stderr; padronize mensagens-chave (OTP enviado, sessão criada)
- Monitoramento
  - UptimeRobot a cada 5 min em / (ou crie /healthz) para reduzir “frio” e alertar indisponibilidade
- CI/CD (opcional após estabilizar)
  - PRs em staging → deploy preview (Vercel)
  - Actions rodando manage.py check e testes

## 10) Futuras melhorias de baixo risco

- Throttling de OTP (DRF throttling)
- Sentry para erros; métricas básicas
- Ajuste de tempos dos tokens (Access 4h; Refresh 1d) conforme uso real
- Endpoint /healthz simples para health-check
- Política de senha/OTP e auditoria mais detalhada

---

Anotações

- O plano “always on” do Render já evita o sono do backend.
- Para domínios próprios, configure DNS/SSL e atualize ALLOWED_HOSTS/CORS na produção.
- Para segurança máxima, considere migrar tokens para cookies HttpOnly (exige ajustes de CSRF) – atual abordagem com Bearer + localStorage prioriza simplicidade de MVP.
