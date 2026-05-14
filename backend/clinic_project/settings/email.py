"""
Configuração de e-mail: backend SMTP ou console (em DEBUG), credenciais SMTP.
"""
from decouple import config

from ._helpers import DEBUG

# === E-mail ===

_configured_email_backend: str = config("EMAIL_BACKEND", default="")
USE_CONSOLE_EMAIL_IN_DEBUG: bool = config(
    "USE_CONSOLE_EMAIL_IN_DEBUG", default=True, cast=bool
)

if DEBUG and USE_CONSOLE_EMAIL_IN_DEBUG:
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
else:
    EMAIL_BACKEND = (
        _configured_email_backend or 'django.core.mail.backends.smtp.EmailBackend'
    )

DEFAULT_FROM_EMAIL: str = config(
    "DEFAULT_FROM_EMAIL", default="noreply@clinicsystem.app"
)
EMAIL_HOST: str = config("EMAIL_HOST", default="smtp.mail.me.com")
EMAIL_PORT: int = config("EMAIL_PORT", default=587, cast=int)
EMAIL_USE_TLS: bool = config("EMAIL_USE_TLS", default=True, cast=bool)
EMAIL_HOST_USER: str = config("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD: str = config("EMAIL_HOST_PASSWORD", default="")
