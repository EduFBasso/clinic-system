# backend\apps\register\views_auth_code.py
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.utils import timezone
from apps.register.models import Professional, AccessCode, DeviceSession
from apps.register.serializers import ProfessionalSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from apps.register.services.validation_utils import is_valid_email
from apps.register.services.otp_service import request_otp_code
import logging
from django.conf import settings

logger = logging.getLogger(__name__)


@api_view(['POST'])
def request_otp_view(request):
    email = request.data.get('email')

    if not is_valid_email(email):
        return Response({'error': 'E-mail inválido.'}, status=400)

    resultado = request_otp_code(email)

    if resultado.get('success'):
        # Em DEBUG, a mensagem pode conter o código (DEV: 1234) para agilizar testes
        return Response({'message': resultado.get('message', 'Código enviado com sucesso.')})
    else:
        # Retorna 500 se houve falha de infraestrutura de e-mail; 404 se profissional não encontrado
        msg = resultado.get('message') or 'Falha ao processar solicitação.'
        status_code = 404 if 'Profissional não encontrado' in msg else status.HTTP_500_INTERNAL_SERVER_ERROR
        return Response({'error': msg}, status=status_code)


@api_view(["POST"])
def verify_code(request):
    import re
    # Normaliza entradas vindas de dispositivos móveis (espaços, etc.)
    email = (request.data.get("email") or "").strip().lower()
    raw_code = (request.data.get("code") or "").strip()
    # Mantém apenas dígitos e limita a 4 caracteres (formato do nosso OTP)
    code_digits = re.sub(r"\D", "", raw_code)
    code = code_digits[:4] if code_digits else ""
    device_id = (request.data.get("device_id") or "").strip()[:64]
    fallback_pass = "0000" # Senha alternativa para testes

    # Redact sensitive data in logs
    red_email = (email or "").split("@")[0] + "@***"
    red_code = "****" if code else None
    logger.info(f"[Verificação OTP] user=\"{red_email}\" code=\"{red_code}\"")

    try:
        professional = Professional.objects.get(email=email)
    except Professional.DoesNotExist:
        return Response(
            {"valid": False, "message": "Profissional não encontrado."},
            status=status.HTTP_404_NOT_FOUND
        )

    if not code or len(code) != 4:
        return Response(
            {"valid": False, "message": "Código inválido."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # 🔑 Fallback: senha alternativa (somente se habilitado via env)
    if getattr(settings, 'ALLOW_OTP_FALLBACK', False) and settings.OTP_FALLBACK_CODE and code == settings.OTP_FALLBACK_CODE:
        logger.info(f"[Fallback] OTP autorizado via fallback para user=\"{red_email}\"")
        refresh = RefreshToken.for_user(professional)
        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "professional": ProfessionalSerializer(professional).data
        })

    # 🔍 Busca código padrão OTP
    # Procura SEMPRE o código mais recente, não utilizado e ainda válido para evitar colisões
    # com códigos antigos (mesmo número) já usados/expirados.
    now = timezone.now()
    access_code = (
        AccessCode.objects
        .filter(
            professional=professional,
            code=code,
            is_used=False,
            expires_at__gte=now,
        )
        .order_by('-created_at')
        .first()
    )

    if not access_code:
        return Response(
            {"valid": False, "message": "Código não encontrado para este profissional."},
            status=status.HTTP_404_NOT_FOUND
        )

    # As validações de "já utilizado" e "expirado" estão cobertas no filtro acima,
    # mas mantemos mensagens específicas caso algo passe batido por uma corrida rara.
    if access_code.is_used:
        return Response(
            {"valid": False, "message": "Código já utilizado."},
            status=status.HTTP_400_BAD_REQUEST
        )

    if access_code.expires_at < now:
        return Response(
            {"valid": False, "message": "Código expirado."},
            status=status.HTTP_401_UNAUTHORIZED
        )

    # ✅ Tudo certo — marcar como usado
    access_code.is_used = True
    access_code.save()

    # Sessões de dispositivo: criar/reativar sessão e impor limite
    max_sessions = getattr(settings, "MAX_ACTIVE_DEVICE_SESSIONS", 2)
    if not device_id:
        device_id = f"otp-{access_code.id}"
    ua = (request.META.get("HTTP_USER_AGENT", "") or "")[:255]
    ip = request.META.get("REMOTE_ADDR")

    session, created = DeviceSession.objects.get_or_create(
        professional=professional,
        device_id=device_id,
        defaults={
            "user_agent": ua,
            "ip_address": ip,
            "is_active": True,
        },
    )
    if not created:
        if not session.is_active:
            session.is_active = True
        session.user_agent = ua
        session.ip_address = ip
        session.save()

    active_qs = DeviceSession.objects.filter(professional=professional, is_active=True)
    active_count = active_qs.count()
    if active_count > max_sessions:
        overflow = active_count - max_sessions
        to_close = (
            DeviceSession.objects
            .filter(professional=professional, is_active=True)
            .exclude(device_id=device_id)
            .order_by("last_seen_at")[:overflow]
        )
        for s in to_close:
            s.terminate(reason="limit")
        active_count = max_sessions

    # Gerar JWT
    refresh = RefreshToken.for_user(professional)
    access_token = str(refresh.access_token)
    refresh_token = str(refresh)

    logger.info(f"[Código Validado] user=\"{red_email}\"")

    return Response({
        "access": access_token,
        "refresh": refresh_token,
        "professional": ProfessionalSerializer(professional).data,
        "active_sessions_count": active_count,
        "device_id": device_id,
    }, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_device(request):
    """Termina a sessão ativa do device informado para o usuário autenticado.

    Espera: Authorization: Bearer <access>, body { device_id }
    Se device_id não for enviado, tenta encerrar pela combinação de user_agent/ip atual.
    """
    device_id = (request.data.get("device_id") or "").strip()[:64]
    if not request.user or not request.user.is_authenticated:
        return Response({"detail": "Não autenticado."}, status=status.HTTP_401_UNAUTHORIZED)

    # Tenta localizar a sessão e encerrá-la
    qs = DeviceSession.objects.filter(professional=request.user, is_active=True)
    if device_id:
        qs = qs.filter(device_id=device_id)
    session = qs.order_by("-last_seen_at").first()
    if not session:
        return Response({"detail": "Sessão não encontrada."}, status=status.HTTP_404_NOT_FOUND)
    session.terminate(reason="logout")
    remaining = DeviceSession.objects.filter(professional=request.user, is_active=True).count()
    return Response({"ok": True, "remaining_active": remaining})
