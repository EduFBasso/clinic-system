import os
from datetime import timedelta
from pathlib import Path

from decouple import config
from corsheaders.defaults import default_headers


BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = config("DJANGO_SECRET_KEY", default="fallback-key-only-for-dev")

DEBUG = config("DEBUG", default=False, cast=bool)
APP_VERSION = config("APP_VERSION", default="dev")

TELEGRAM_BOT_TOKEN = config("TELEGRAM_BOT_TOKEN", default="")
TELEGRAM_BOT_API_BASE = config(
    "TELEGRAM_BOT_API_BASE", default="https://api.telegram.org"
)
TELEGRAM_BOT_TIMEOUT_SECONDS = config(
    "TELEGRAM_BOT_TIMEOUT_SECONDS", default=10, cast=int
)

ALLOWED_HOSTS = config(
    "DJANGO_ALLOWED_HOSTS",
    default="localhost,127.0.0.1",
    cast=lambda v: [s.strip() for s in v.split(",")],
)

INSTALLED_APPS = [
    'rest_framework',
    'apps.agenda',
    'apps.anamnesis',
    'apps.clients',
    'apps.reminders',
    'apps.register',
    'apps.inventory',
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
    'corsheaders.middleware.CorsMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'clinic_project.middleware.QueryTimingMiddleware',
    'clinic_project.middleware.VersionHeaderMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    default="http://localhost:5173,http://127.0.0.1:5173",
    cast=lambda v: [s.strip() for s in v.split(",")],
)

CORS_ALLOWED_ORIGIN_REGEXES = config(
    "CORS_ALLOWED_ORIGIN_REGEXES",
    default="",
    cast=lambda v: [r.strip() for r in v.split(",") if r.strip()],
)

CORS_ALLOW_ALL_ORIGINS = config("CORS_ALLOW_ALL_ORIGINS", default=False, cast=bool)
CORS_ALLOW_CREDENTIALS = config("CORS_ALLOW_CREDENTIALS", default=False, cast=bool)

CORS_ALLOW_HEADERS = list(default_headers) + [
    'x-device-id',
    'x-device-info',
    'x-client-now',
]

CORS_PREFLIGHT_MAX_AGE = config("CORS_PREFLIGHT_MAX_AGE", default=600, cast=int)

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

_IN_CI = os.environ.get('GITHUB_ACTIONS') == 'true'
_USE_SQLITE_FOR_TESTS = config('TEST_USE_SQLITE', default=False, cast=bool) or _IN_CI
if _USE_SQLITE_FOR_TESTS:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': ':memory:',
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': config('DB_NAME', default='clinic'),
            'USER': config('DB_USER', default='clinic'),
            'PASSWORD': config('DB_PASSWORD', default='clinic'),
            'HOST': config('DB_HOST', default='localhost'),
            'PORT': config('DB_PORT', default='5432'),
            'CONN_MAX_AGE': config('DB_CONN_MAX_AGE', default=60, cast=int),
            'OPTIONS': {'options': '-c client_encoding=UTF8'},
        }
    }

ATOMIC_REQUESTS = True

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
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
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

MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'apps.register.auth_device.JWTDeviceAuthentication',
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ),
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ] if not DEBUG else [
        'rest_framework.renderers.JSONRenderer',
        'rest_framework.renderers.BrowsableAPIRenderer',
    ],
}

CSRF_TRUSTED_ORIGINS = config(
    "CSRF_TRUSTED_ORIGINS",
    default="",
    cast=lambda v: [s.strip() for s in v.split(",") if s.strip()],
)

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=10),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),
    "ROTATE_REFRESH_TOKENS": False,
    "BLACKLIST_AFTER_ROTATION": False,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

ALLOW_OTP_FALLBACK = config("ALLOW_OTP_FALLBACK", default=False, cast=bool)
OTP_FALLBACK_CODE = config("OTP_FALLBACK_CODE", default="")

MAX_ACTIVE_DEVICE_SESSIONS = config("MAX_ACTIVE_DEVICE_SESSIONS", default=2, cast=int)

_configured_email_backend = config("EMAIL_BACKEND", default="")
USE_CONSOLE_EMAIL_IN_DEBUG = config("USE_CONSOLE_EMAIL_IN_DEBUG", default=True, cast=bool)
if DEBUG and USE_CONSOLE_EMAIL_IN_DEBUG:
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
else:
    EMAIL_BACKEND = _configured_email_backend or 'django.core.mail.backends.smtp.EmailBackend'

DEFAULT_FROM_EMAIL = config("DEFAULT_FROM_EMAIL", default="noreply@clinicsystem.app")
EMAIL_HOST = config("EMAIL_HOST", default="smtp.mail.me.com")
EMAIL_PORT = config("EMAIL_PORT", default=587, cast=int)
EMAIL_USE_TLS = config("EMAIL_USE_TLS", default=True, cast=bool)
EMAIL_HOST_USER = config("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = config("EMAIL_HOST_PASSWORD", default="")

if not DEBUG and not _IN_CI:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000  # 1 year
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

LOG_LEVEL = 'DEBUG' if DEBUG else 'INFO'
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'standard': {
            'format': '[%(asctime)s] %(levelname)s %(name)s: %(message)s'
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'standard',
            'level': LOG_LEVEL,
        },
    },
    'root': {
        'handlers': ['console'],
        'level': LOG_LEVEL,
    },
    'loggers': {
        'django.db.backends': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'urllib3': {
            'handlers': ['console'],
            'level': 'WARNING',
            'propagate': False,
        },
        'requests': {
            'handlers': ['console'],
            'level': 'WARNING',
            'propagate': False,
        },
        'performance': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        }
    }
}

# === TOTP ===
TOTP_ISSUER = config("TOTP_ISSUER", default="ClinicSystem")

# === WebAuthn / Passkeys ===
# rpId: domain sem esquema/porta. localhost para dev; domínio real em produção.
WEBAUTHN_RP_ID = config("WEBAUTHN_RP_ID", default="localhost")
WEBAUTHN_RP_NAME = config("WEBAUTHN_RP_NAME", default="ClinicSystem")
# Origens aceitas separadas por vírgula (incluir http em dev, https em produção)
WEBAUTHN_ORIGINS = config(
    "WEBAUTHN_ORIGINS",
    default="http://localhost:5173",
    cast=lambda v: [s.strip() for s in v.split(",") if s.strip()],
)
