# apps.register.services.access_code.py
import secrets
from datetime import datetime, timedelta
from apps.register.models import AccessCode

def generate_access_code(professional):
    code = str(secrets.randbelow(10000)).zfill(4)
    expires = datetime.now() + timedelta(minutes=10)
    return AccessCode.objects.create(professional=professional, code=code, expires_at=expires)

"""
📘 Módulo: access_code.py — services
Responsável pela geração segura de códigos temporários para autenticação via OTP.

📦 Função incluída
generate_access_code(professional)
- Gera um código numérico de 4 dígitos usando o módulo secrets (mais seguro que random)
- Define a expiração do código (expires_at) — padrão: 10 minutos
- Salva e retorna uma instância do modelo AccessCode

🔗 Utiliza
- AccessCode (modelo)
- secrets.randbelow() para aleatoriedade segura
- datetime + timedelta para calcular tempo de validade

📘 Módulo: notifications.py — services
Responsável pelo envio (simulado) de notificações de código via email e WhatsApp.

📦 Funções incluídas
send_code_email(professional, code)
- Simula envio de email com o código gerado
send_code_whatsapp(professional, code)
- Simula envio de mensagem WhatsApp com o código

"""