# backend\apps\register\services\notifications.py
import logging
from django.core.mail import send_mail
from django.conf import settings
from apps.register.models import Professional

logger = logging.getLogger(__name__)

def send_code_email(professional: Professional, code: str) -> None:
    """
    Envia o código OTP por e-mail para o profissional especificado.
    """
    if not professional.email:
        logger.warning(f"Profissional sem e-mail: {professional}")
        return

    subject = "📌 Seu código de acesso"
    message = f"""
Olá {professional.first_name},

Seu código de verificação é: {code}

Este código é válido por 10 minutos.
Se você não solicitou este acesso, ignore este e-mail.

Equipe Clínica
""".strip()

    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[professional.email],
            fail_silently=False
        )
        logger.info(f"E-mail enviado com sucesso para {professional.email}: código {code}")
    except Exception as e:
        logger.error(f"Erro ao enviar e-mail para {professional.email}: {str(e)}")



#  Integração com WhatsApp (simulação)
logger = logging.getLogger(__name__)

def send_code_whatsapp(phone_number: str, code: str) -> None:
    """
    Simula o envio de código OTP via WhatsApp para o número especificado.
    A chamada real da API está comentada.
    """
    if not phone_number:
        logger.warning("Nenhum número de telefone fornecido para envio via WhatsApp.")
        return


    # Simulação de formatação do número internacional
    formatted = format_whatsapp_number(phone_number)
    message = f"🔐 Seu código de acesso é: {code} (válido por 10 minutos)"

    # Simulação no terminal
    logger.info(f"[Simulação WhatsApp] Enviando para {formatted}: {message}")

        # Integração futura (exemplo com API fictícia):
        # import requests
        # response = requests.post("https://api.whatsapp-gateway.com/send", json={
        #     "to": formatted,
        #     "message": message,
        #     "auth": {"api_key": "SUA_CHAVE_AQUI"}
        # })
        # if response.status_code != 200:
        #     logger.error(f"Erro ao enviar WhatsApp: {response.text}")
    
    def format_whatsapp_number(raw_number: str) -> str:
        """
        Formata o número bruto para padrão internacional (+55...).
        Aceita números com DDD e remove caracteres extras.
        """
        import re
        digits = re.sub(r'\D', '', raw_number)  # Remove tudo que não for número
        if digits.startswith("55"):
            return f"+{digits}"
        return f"+55{digits}"
