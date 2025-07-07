# apps.register.services.notifications.py

def send_code_email(professional, code):
    # Aqui você pode integrar com send_mail do Django
    print(f"Email enviado para {professional.email}: seu código de acesso é {code}")

def send_code_whatsapp(professional, code):
    # Aqui você pode integrar com Z-API ou Twilio
    print(f"WhatsApp enviado para {professional.phone}: seu código é {code}")
