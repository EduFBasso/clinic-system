# apps.register.views_auth_code.py
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.utils import timezone
from .models import AccessCode, Professional
from .services.access_code import generate_access_code
from .services.notifications import send_code_email, send_code_whatsapp
from rest_framework_simplejwt.tokens import RefreshToken

@api_view(['POST'])
def request_code(request):
    email = request.data.get('email')
    try:
        professional = Professional.objects.get(email=email)
        code_entry = generate_access_code(professional)
        send_code_email(professional, code_entry.code)
        send_code_whatsapp(professional, code_entry.code)
        return Response({'message': 'Código enviado'})
    except Professional.DoesNotExist:
        return Response({'error': 'Profissional não encontrado'}, status=404)

@api_view(['POST'])
def verify_code(request):
    email = request.data.get('email')
    code = request.data.get('code')
    try:
        professional = Professional.objects.get(email=email)
        access_code = AccessCode.objects.filter(professional=professional, code=code, is_used=False).last()
        if not access_code or access_code.expires_at < timezone.now():
            return Response({'error': 'Código inválido ou expirado'}, status=403)
        access_code.is_used = True
        access_code.save()
        refresh = RefreshToken.for_user(professional)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'professional': {
                'id': professional.id,
                'first_name': professional.first_name,
                'last_name': professional.last_name,
                'email': professional.email
            }
        })
    except Professional.DoesNotExist:
        return Response({'error': 'Profissional não encontrado'}, status=404)

"""
📘 Módulo: views_auth_code.py — apps.register
Responsável pelo fluxo completo de autenticação via código temporário numérico (OTP), usado como alternativa ao login tradicional com senha.

📦 Funções incluídas
1. request_code(request)
- Gera um código seguro de 4 dígitos com secrets
- Salva no modelo AccessCode, com validade de 10 minutos (configurável)
- Envia o código via email e WhatsApp (simulado pelas funções send_code_email() e send_code_whatsapp())
2. verify_code(request)
- Verifica se o código informado:
- Pertence ao profissional certo
- Está dentro da validade (expires_at)
- Ainda não foi utilizado (is_used = False)
- Em caso de sucesso:
- Marca o código como usado
- Gera access e refresh tokens JWT
- Retorna os dados essenciais do profissional logado

🔗 Integrações utilizadas
- Modelos: Professional, AccessCode
- Serviços:
- generate_access_code(professional)
- send_code_email(professional, code)
- send_code_whatsapp(professional, code)
- Bibliotecas externas:
- datetime para expiração
- RefreshToken do rest_framework_simplejwt para JWT

📌 Observações técnicas
- Proteção contra uso indevido com validação de código único e expiração
- Pronto para testes unitários com pytest
- Rota esperada:
- /auth/request-code/ (POST com email)
- /auth/verify-code/ (POST com email + code)
"""