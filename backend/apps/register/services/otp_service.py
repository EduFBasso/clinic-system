# backend\apps\register\services\otp_service.py
from django.conf import settings
from apps.register.models import Professional
from apps.register.services.access_code import generate_access_code
from apps.register.services.notifications import send_code_email

def request_otp_code(email):
    # Normaliza para evitar problemas de caixa/espaços
    email = (email or "").strip()
    try:
        profissional = Professional.objects.get(email__iexact=email)
        code_entry = generate_access_code(profissional)
        sent_ok = send_code_email(profissional, code_entry.code)
        # Em desenvolvimento, opcionalmente incluir o código na mensagem para agilizar testes
        if settings.DEBUG and sent_ok:
            return {"success": True, "message": f"Código enviado com sucesso. (DEV: {code_entry.code})"}
        if sent_ok:
            return {"success": True, "message": "Código enviado com sucesso."}
        else:
            return {"success": False, "message": "Falha ao enviar o código por e-mail. Verifique as configurações de e-mail."}
    except Professional.DoesNotExist:
        return {"success": False, "message": "Profissional não encontrado."}
