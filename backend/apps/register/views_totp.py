import re
import pyotp
import logging
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from django.conf import settings
from .models import Professional, DeviceSession
from .serializers import ProfessionalSerializer

logger = logging.getLogger(__name__)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def totp_setup(request):
    """Generate (or regenerate) a TOTP secret for the authenticated professional.

    Returns the otpauth:// URI so the frontend can render a QR code.
    The secret is saved immediately — the professional must verify a code
    (via totp_confirm) before the secret is considered active. For simplicity
    in phase 1 we save it directly and rely on the verify endpoint.

    POST /register/auth/totp/setup/
    Response: { secret, otpauth_uri, issuer }
    """
    user = request.user
    secret = pyotp.random_base32()
    user.totp_secret = secret  # type: ignore[union-attr]
    user.save(update_fields=["totp_secret"])  # type: ignore[union-attr]

    issuer = getattr(settings, "TOTP_ISSUER", "ClinicSystem")
    email = user.email  # type: ignore[union-attr]
    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name=email, issuer_name=issuer)

    logger.info("[TOTP Setup] New secret generated for user=%s", email)
    return Response({
        "secret": secret,
        "otpauth_uri": uri,
        "issuer": issuer,
    })


@api_view(["POST"])
def totp_verify(request):
    """Authenticate using email + TOTP code, return JWT.

    Replaces the OTP-email flow for professionals that have TOTP configured.

    POST /register/auth/totp/verify/
    Body: { email, code, device_id (optional) }
    Response: { access, refresh, professional, device_id }
    """
    email = (request.data.get("email") or "").strip()
    raw_code = (request.data.get("code") or "").strip()
    code = re.sub(r"\D", "", raw_code)[:6]
    device_id = (request.data.get("device_id") or "").strip()[:64]

    red_email = email.split("@")[0] + "@***" if "@" in email else "***"
    logger.info("[TOTP Verify] user=%s", red_email)

    if not email or not code or len(code) != 6:
        return Response(
            {"valid": False, "message": "E-mail e código de 6 dígitos são obrigatórios."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        professional = Professional.objects.get(email__iexact=email)
    except Professional.DoesNotExist:
        return Response(
            {"valid": False, "message": "Profissional não encontrado."},
            status=status.HTTP_404_NOT_FOUND,
        )

    if not professional.is_active:
        return Response(
            {"valid": False, "message": "Conta desativada."},
            status=status.HTTP_403_FORBIDDEN,
        )

    if not professional.totp_secret:
        return Response(
            {"valid": False, "message": "TOTP não configurado para este profissional."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    totp = pyotp.TOTP(professional.totp_secret)
    # valid_window=1 allows ±30s clock drift (one window before/after)
    if not totp.verify(code, valid_window=1):
        logger.warning("[TOTP Verify] Invalid code for user=%s", red_email)
        return Response(
            {"valid": False, "message": "Código inválido ou expirado."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    # Register device session
    if not device_id:
        device_id = f"totp-{professional.pk}"
    ua = (request.META.get("HTTP_USER_AGENT", "") or "")[:255]
    ip = request.META.get("REMOTE_ADDR")

    session, created = DeviceSession.objects.get_or_create(
        professional=professional,
        device_id=device_id,
        defaults={"user_agent": ua, "ip_address": ip, "is_active": True},
    )
    if not created:
        session.is_active = True
        session.user_agent = ua
        session.ip_address = ip
        session.save()

    # Enforce session limit
    max_sessions = getattr(settings, "MAX_ACTIVE_DEVICE_SESSIONS", 2)
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

    refresh = RefreshToken.for_user(professional)
    logger.info("[TOTP Verify] Success for user=%s", red_email)

    return Response({
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "professional": ProfessionalSerializer(professional).data,
        "active_sessions_count": active_count,
        "device_id": device_id,
    }, status=status.HTTP_200_OK)
