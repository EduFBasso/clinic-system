# backend\apps\register\views_auth_code.py
from rest_framework.response import Response
from rest_framework.decorators import api_view
from rest_framework import status
from django.utils import timezone
from apps.register.models import Professional, AccessCode
from apps.register.serializers import ProfessionalSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from apps.register.services.validation_utils import is_valid_email
from apps.register.services.otp_service import request_otp_code
import logging

logger = logging.getLogger(__name__)


@api_view(['POST'])
def request_otp_view(request):
    email = request.data.get('email')

    if not is_valid_email(email):
        return Response({'error': 'E-mail inválido.'}, status=400)

    resultado = request_otp_code(email)

    if resultado['success']:
        return Response({'message': resultado['message']})
    else:
        return Response({'error': resultado['message']}, status=404)


@api_view(["POST"])
def verify_code(request):
    email = request.data.get("email")
    code = request.data.get("code")
    fallback_pass = "0000" # Senha alternativa para testes

    logger.info(f"[Verificação OTP] E-mail: {email} | Código: {code}")

    try:
        professional = Professional.objects.get(email=email)
    except Professional.DoesNotExist:
        return Response(
            {"valid": False, "message": "Profissional não encontrado."},
            status=status.HTTP_404_NOT_FOUND
        )

    # 🔑 Fallback: senha alternativa (fase de testes)
    if code == fallback_pass:
        logger.info(f"[Fallback] Autenticado por senha alternativa: {professional.email}")
        refresh = RefreshToken.for_user(professional)
        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "professional": ProfessionalSerializer(professional).data
        })

    # 🔍 Busca código padrão OTP
    access_code = AccessCode.objects.filter(
        professional=professional,
        code=code
    ).first()

    if not access_code:
        return Response(
            {"valid": False, "message": "Código não encontrado para este profissional."},
            status=status.HTTP_404_NOT_FOUND
        )

    if access_code.is_used:
        return Response(
            {"valid": False, "message": "Código já utilizado."},
            status=status.HTTP_400_BAD_REQUEST
        )

    if access_code.expires_at < timezone.now():
        return Response(
            {"valid": False, "message": "Código expirado."},
            status=status.HTTP_401_UNAUTHORIZED
        )

    # ✅ Tudo certo — marcar como usado
    access_code.is_used = True
    access_code.save()

    # Gerar JWT
    refresh = RefreshToken.for_user(professional)
    access_token = str(refresh.access_token)
    refresh_token = str(refresh)

    logger.info(f"[Código Validado] Profissional: {professional.email} | Código: {code}")

    return Response({
        "access": access_token,
        "refresh": refresh_token,
        "professional": ProfessionalSerializer(professional).data
    }, status=status.HTTP_200_OK)