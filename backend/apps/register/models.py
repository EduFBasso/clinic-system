# backend/apps/register/models.py
from phonenumber_field.modelfields import PhoneNumberField
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.utils import timezone

class ProfessionalManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("O e-mail é obrigatório")

        email = self.normalize_email(email)
        extra_fields.setdefault("is_staff", False)       # Não é staff
        extra_fields.setdefault("is_superuser", False)   # Nem superusuário

        user = self.model(email=email, **extra_fields)

        if password:
            user.set_password(password)  # Criptografa a senha
        else:
            user.set_unusable_password() # Se for login via código/OTP

        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        # Apenas para uso interno, por exemplo: Django Admin
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(email, password, **extra_fields)


class Professional(AbstractBaseUser, PermissionsMixin):
    first_name = models.CharField("Nome", max_length=50)
    last_name = models.CharField("Sobrenome", max_length=70)
    phone = PhoneNumberField("Telefone", region="BR", blank=True) # type: ignore
    email = models.EmailField("E-mail", unique=True)

    register_number = models.CharField(
        "Registro Profissional", 
        max_length=30, 
        unique=True,
        blank=True,
        null=True
    )
    specialty = models.CharField("Especialidade", max_length=100, blank=True)
    can_manage_professionals = models.BooleanField(
    default=False,
    verbose_name="Pode gerenciar profissionais"
)
    totp_secret = models.CharField(
        "TOTP Secret",
        max_length=64,
        blank=True,
        help_text="Base32 secret for TOTP (Google Authenticator). Empty = TOTP not configured.",
    )

    # Endereço
    city = models.CharField("Cidade", max_length=50, blank=True)
    state = models.CharField("Estado", max_length=2, blank=True)

    is_staff = models.BooleanField(default=True)
    is_active = models.BooleanField("Ativo", default=True)
    created_at = models.DateTimeField("Criado em", auto_now_add=True)
    deactivated_at = models.DateTimeField("Desativado em", null=True, blank=True)
    deactivation_reason = models.CharField(
        "Motivo desativação", max_length=120, blank=True
    )

    objects = ProfessionalManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]

    def __str__(self):
        return f"{self.first_name} {self.last_name} — {self.register_number}"

    # Soft delete helper
    def deactivate(self, reason: str = ""):
        if not self.deactivated_at:
            self.deactivated_at = timezone.now()
        if reason:
            self.deactivation_reason = reason[:120]
        self.is_active = False
        self.save(update_fields=["deactivated_at", "deactivation_reason", "is_active"])

    def reactivate(self):
        self.is_active = True
        self.deactivated_at = None
        self.deactivation_reason = ""
        self.save(update_fields=["is_active", "deactivated_at", "deactivation_reason"])


class DeviceSession(models.Model):
    """Sessão de dispositivo por profissional para auditoria e controle de limite.

    - device_id: um identificador persistente gerado no frontend (UUID/string curta).
    - is_active: ativa enquanto a sessão estiver em uso; ao sair, marcar inativa e registrar terminated_at.
    - last_seen_at: atualizado quando o dispositivo interage (pode ser via heartbeat/requests autenticadas).
    """

    professional = models.ForeignKey(Professional, on_delete=models.CASCADE, related_name="sessions")
    device_id = models.CharField(max_length=64)
    user_agent = models.CharField(max_length=255, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(auto_now=True)
    terminated_at = models.DateTimeField(null=True, blank=True)
    termination_reason = models.CharField(max_length=32, blank=True)

    class Meta:
        unique_together = ("professional", "device_id")
        indexes = [
            models.Index(fields=["professional", "is_active"]),
            models.Index(fields=["professional", "device_id"]),
        ]

    def __str__(self):
        status = "ativa" if self.is_active else "inativa"
        return f"{self.professional.email} — {self.device_id} ({status})"

    def terminate(self, reason: str = "logout"):
        self.is_active = False
        self.terminated_at = timezone.now()
        self.termination_reason = reason[:32]
        self.save(update_fields=["is_active", "terminated_at", "termination_reason"])


class ProfessionalSettings(models.Model):
    """Configurações por profissional para a agenda e comunicação.

    - work_start_hour: hora de início padrão da agenda (0..23)
    - work_end_hour: hora de fim padrão (1..24)
    - slot_minutes: duração dos slots (ex.: 15, 30, 60)
    - confirm_message_enabled: ativa envio de confirmação (futuro)
    - confirm_message_template: template opcional da mensagem
    """

    professional = models.OneToOneField(
        Professional,
        on_delete=models.CASCADE,
        related_name="settings",
        verbose_name="Profissional",
    )
    work_start_hour = models.PositiveSmallIntegerField(default=8)
    work_end_hour = models.PositiveSmallIntegerField(default=18)
    slot_minutes = models.PositiveSmallIntegerField(default=30)

    confirm_message_enabled = models.BooleanField(default=False)
    confirm_message_template = models.TextField(blank=True)

    # PIX defaults (for quick budget payments)
    PIX_KEY_TYPES = (
        ("telefone", "Telefone"),
        ("cpf", "CPF"),
        ("email", "E-mail"),
        ("aleatoria", "Aleatória"),
    )
    pix_key_type = models.CharField(
        max_length=16, choices=PIX_KEY_TYPES, blank=True, default=""
    )
    pix_key_value = models.CharField(max_length=128, blank=True, default="")

    # Push notification reminder (same-day)
    reminder_enabled = models.BooleanField(default=False)
    reminder_minutes_before = models.PositiveSmallIntegerField(
        default=90,
        help_text="Quantos minutos antes do compromisso enviar o lembrete push.",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Configuração do Profissional"
        verbose_name_plural = "Configurações de Profissionais"

    def __str__(self):
        return f"Config {self.professional.email} ({self.work_start_hour}-{self.work_end_hour}/{self.slot_minutes}m)"


class PushSubscription(models.Model):
    """Assinatura Web Push de um profissional.

    Uma por dispositivo/navegador. O endpoint é único e identifica a assinatura.
    Deletada automaticamente quando o push retorna 404/410 (expirada).
    """

    professional = models.ForeignKey(
        Professional,
        on_delete=models.CASCADE,
        related_name="push_subscriptions",
        verbose_name="Profissional",
    )
    endpoint = models.TextField(unique=True)
    p256dh = models.TextField()
    auth = models.TextField()
    user_agent = models.CharField(max_length=256, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Assinatura Push"
        verbose_name_plural = "Assinaturas Push"

    def __str__(self):
        return f"{self.professional.email} — {self.endpoint[:60]}"


class WebAuthnCredential(models.Model):
    """Credencial WebAuthn (passkey / biometria) de um profissional.

    Armazena o resultado de um registro bem-sucedido feito via
    navigator.credentials.create() no frontend.  Cada profissional pode ter
    múltiplas credenciais (iPhone, iPad, etc.).
    """

    professional = models.ForeignKey(
        Professional,
        on_delete=models.CASCADE,
        related_name="webauthn_credentials",
    )
    # id base64url retornado pelo @simplewebauthn/browser
    credential_id = models.TextField(unique=True)
    # Chave pública COSE codificada em base64 (bytes brutos do py_webauthn)
    public_key = models.TextField()
    sign_count = models.PositiveIntegerField(default=0)
    # Nome amigável (user-agent resumido, e.g. "iPhone de Eduardo")
    device_name = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Credencial WebAuthn"
        verbose_name_plural = "Credenciais WebAuthn"

    def __str__(self):
        return f"{self.professional.email} — {self.device_name or self.credential_id[:12]}"

