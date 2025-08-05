# apps.register.services.access_code.py
from datetime import datetime, timedelta
from secrets import randbelow
from apps.register.models import AccessCode, Professional
from django.utils import timezone

def generate_access_code(professional: Professional) -> AccessCode:
    """
    Gera um código de acesso aleatório de 4 dígitos e o registra com 
    expiração de 10 minutos.
    """
    code = f"{randbelow(10000):04}"  # Formata com zeros à esquerda
    expires_at = timezone.now() + timedelta(minutes=10)

    return AccessCode.objects.create(
        professional=professional,
        code=code,
        expires_at=expires_at
    )
