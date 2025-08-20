# backend\apps\register\services\otp_service.py
from apps.register.models import Professional, AccessCode
from apps.register.services.access_code import generate_access_code
from apps.register.services.notifications import send_code_email
from django.utils import timezone

def request_otp_code(email):
    try:
        profissional = Professional.objects.get(email=email)
        code_entry = generate_access_code(profissional)
        send_code_email(profissional, code_entry.code)
        return {"success": True, "message": "Código enviado com sucesso."}
    except Professional.DoesNotExist:
        return {"success": False, "message": "Profissional não encontrado."}

from django.utils import timezone
from apps.register.models import AccessCode, Professional

def validate_otp_code(email: str, code: str):
    try:
        professional = Professional.objects.get(email=email)
    except Professional.DoesNotExist:
        return {"valid": False, "message": "Profissional não encontrado."}

    access_code = AccessCode.objects.filter(
        professional=professional,
        code=code
    ).first()

    if not access_code:
        return {"valid": False, "message": "Código não encontrado para este profissional."}

    if access_code.is_used:
        return {"valid": False, "message": "Código já utilizado."}

    if access_code.expires_at < timezone.now():
        return {"valid": False, "message": "Código expirado."}

    # Código está OK!
    access_code.is_used = True
    access_code.save()
    return {"valid": True, "message": "Código validado com sucesso."}
