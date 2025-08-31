# backend\clinic_project\settings.py
import os
from datetime import timedelta
from pathlib import Path

from decouple import config


BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = config("DJANGO_SECRET_KEY", default="fallback-key-only-for-dev")

DEBUG = config("DEBUG", default=False, cast=bool)

ALLOWED_HOSTS = config(
    "DJANGO_ALLOWED_HOSTS",
    default="localhost,127.0.0.1",
    cast=lambda v: [s.strip() for s in v.split(",")],
)
# ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'rest_framework',
    'apps.register',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
]

AUTH_USER_MODEL = 'register.Professional'

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]
CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    default=(
        "http://localhost:5173,"
        "http://127.0.0.1:5173,"
        "http://192.168.0.129:5173"
    ),
    cast=lambda v: [s.strip() for s in v.split(",")],
)

# Optional: allow regex origins via env var for preview deployments (e.g., Vercel)
# Example: CORS_ALLOWED_ORIGIN_REGEXES=^https://.*\.vercel\.app$
_cors_regex_csv = config("CORS_ALLOWED_ORIGIN_REGEXES", default="", cast=str)
CORS_ALLOWED_ORIGIN_REGEXES = [r.strip() for r in _cors_regex_csv.split(",") if r.strip()]

# Allow enabling a permissive CORS mode from environment for quick testing.
# In production prefer setting `CORS_ALLOWED_ORIGINS` to a CSV of trusted origins.
CORS_ALLOW_ALL_ORIGINS = config("CORS_ALLOW_ALL_ORIGINS", default=False, cast=bool)

# Optional: allow credentials via env var if needed (useful when cookies are used).
CORS_ALLOW_CREDENTIALS = config("CORS_ALLOW_CREDENTIALS", default=False, cast=bool)

ROOT_URLCONF = 'clinic_project.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'clinic_project.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': config("DB_ENGINE", default="django.db.backends.postgresql"),
    'NAME': config("DB_NAME"),
    'USER': config("DB_USER"),
        'PASSWORD': config("DB_PASSWORD"),
        'HOST': config("DB_HOST", default="localhost"),
    'PORT': config("DB_PORT", default="5432"),
    }
}

# Prefer psycopg3 on Windows to avoid legacy encoding issues with psycopg2.
try:
    _engine = DATABASES['default'].get('ENGINE', '')
    if _engine.endswith('postgresql'):
        # Switch to the psycopg (v3) backend name if available
        try:
            import psycopg  # noqa: F401
            DATABASES['default']['ENGINE'] = 'django.db.backends.postgresql'
            DATABASES['default'].setdefault('OPTIONS', {})
            DATABASES['default']['OPTIONS'].setdefault('options', '-c client_encoding=UTF8')
        except Exception:
            # Fallback: still ensure UTF8 option for older driver
            DATABASES['default'].setdefault('OPTIONS', {})
            DATABASES['default']['OPTIONS'].setdefault('options', '-c client_encoding=UTF8')
except Exception:
    pass

# Safety: avoid using remote DB while DEBUG=True unless explicitly allowed.
ALLOW_REMOTE_DB_IN_DEBUG = config("ALLOW_REMOTE_DB_IN_DEBUG", default=False, cast=bool)
if DEBUG and not ALLOW_REMOTE_DB_IN_DEBUG:
    try:
        _db_host = DATABASES['default'].get('HOST') or ''
    except Exception:
        _db_host = ''
    if _db_host not in ("localhost", "127.0.0.1", ""):
        raise RuntimeError(
            "DEBUG=True com DB_HOST não local ('%s'). Evitando conexão acidental ao banco remoto. "
            "Defina ALLOW_REMOTE_DB_IN_DEBUG=True no .env apenas se tiver certeza." % _db_host
        )

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

LOCALE_PATHS = [os.path.join(BASE_DIR, 'locale')]
LANGUAGE_CODE = 'pt-br'
TIME_ZONE = config("TIME_ZONE", default="America/Sao_Paulo")
USE_I18N = True
USE_TZ = True
STATIC_URL = 'static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    )
}

# CSRF trusted origins (only needed if using cookies/session auth or admin from another origin).
# Example: CSRF_TRUSTED_ORIGINS=https://your-app.vercel.app,https://*.yourdomain.com
_csrf_trusted_csv = config("CSRF_TRUSTED_ORIGINS", default="", cast=str)
CSRF_TRUSTED_ORIGINS = [s.strip() for s in _csrf_trusted_csv.split(",") if s.strip()]

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=10),      # token de acesso válido por 10h
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),       # opcional, se quiser usar depois
    "ROTATE_REFRESH_TOKENS": False,
    "BLACKLIST_AFTER_ROTATION": False,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# Security toggles
# Allows a temporary OTP fallback code ONLY when explicitly enabled via env.
# In production, keep ALLOW_OTP_FALLBACK=False.
ALLOW_OTP_FALLBACK = config("ALLOW_OTP_FALLBACK", default=False, cast=bool)
OTP_FALLBACK_CODE = config("OTP_FALLBACK_CODE", default="")

# Device sessions policy
MAX_ACTIVE_DEVICE_SESSIONS = config("MAX_ACTIVE_DEVICE_SESSIONS", default=2, cast=int)

_configured_email_backend = config("EMAIL_BACKEND", default="")
# Em desenvolvimento, use o backend de console por padrão para evitar falhas de SMTP.
# Pode desativar esse comportamento com USE_CONSOLE_EMAIL_IN_DEBUG=False se quiser testar SMTP localmente.
USE_CONSOLE_EMAIL_IN_DEBUG = config("USE_CONSOLE_EMAIL_IN_DEBUG", default=True, cast=bool)
if DEBUG and USE_CONSOLE_EMAIL_IN_DEBUG:
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
else:
    EMAIL_BACKEND = _configured_email_backend or 'django.core.mail.backends.smtp.EmailBackend'

## Notes: operational/how-to content moved to docs (see scripts/db/README.md) to keep settings lean.

# --- Production security hardening (active when DEBUG=False) ---
if not DEBUG:
    # Trust proxy header so Django knows requests are HTTPS behind Render's proxy
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    # Redirect all HTTP to HTTPS
    SECURE_SSL_REDIRECT = True
    # Secure cookies
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    # HSTS to enforce HTTPS in browsers
    SECURE_HSTS_SECONDS = 31536000  # 1 year
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True