<!-- backend\README.md -->

# Clinic System Backend

Este diretório contém o backend do sistema de gerenciamento de clínica de podologia.

## Estrutura

- `apps/register/`: App principal com modelos, views, serializers, serviços e testes.
- `clinic_system/`: Configurações globais do projeto Django.
- `manage.py`: Script para comandos administrativos Django.

## Como rodar localmente

1. Instale as dependências:

   ```
   pip install -r requirements.txt
   ```

2. Configure o ambiente:

   - Copie `backend/.env.example` para `backend/.env` e ajuste as variáveis.
   - (Opcional) Suba um Postgres local: `docker compose -f docker-compose.local.yml up -d`
     - Windows: se tiver o serviço PostgreSQL do Windows ativo (porta 5432), o container usa a porta 55432 no host.
       Garanta que no `backend/.env` esteja `DB_HOST=127.0.0.1` e `DB_PORT=55432`.
       Se preferir 5432, pare o serviço do Windows primeiro.

3. Execute as migrações:

   ```
   python manage.py migrate
   ```

4. Inicie o servidor:
   ```
   python manage.py runserver
   ```

## Rodando os testes

```
python manage.py test
```

## Observações

- O login é feito via código OTP enviado por e-mail.
- Cada profissional só visualiza seus próprios clientes.
- Para produção, configure variáveis de ambiente para dados

## Deploy (Render + Vercel)

Na Render (backend), defina as seguintes variáveis de ambiente para permitir o frontend hospedado na Vercel:

- `DJANGO_ALLOWED_HOSTS`: inclua o host do serviço da Render e outros necessários, separados por vírgula. Ex: `clinic-system-swzd.onrender.com,localhost,127.0.0.1`
- `CORS_ALLOWED_ORIGINS`: origens explícitas (se conhecer a URL do projeto na Vercel). Ex: `https://seuapp.vercel.app`
- `CORS_ALLOWED_ORIGIN_REGEXES`: para prévias do Vercel, use regex. Ex: `^https://.*\.vercel\.app$`
- `CSRF_TRUSTED_ORIGINS`: se for usar cookies/admin a partir do frontend. Ex: `https://seuapp.vercel.app,https://*.vercel.app`

No Vercel (frontend), defina `VITE_API_BASE` para apontar para a URL pública do backend na Render, por exemplo:

```
VITE_API_BASE=https://clinic-system-swzd.onrender.com
```

O frontend também possui um fallback em runtime para usar o domínio da Render quando detecta `*.vercel.app`, mas é recomendável setar `VITE_API_BASE` no build.
