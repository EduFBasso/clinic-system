from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


class Appointment(models.Model):
    """Consulta/compromisso na agenda.

    Campos principais:
    - professional: Profissional dono da agenda (FK apps.register.Professional)
    - client: Cliente atendido (FK apps.register.Client)
    - title: Título curto exibido no card/agenda (ex.: "Retorno", "Avaliação")
    - visit_type: Tipo de consulta (enum simples: avaliacao, retorno, procedimento, outro)
    - start_at / end_at: Janela do agendamento (timezone-aware)
    - location: Texto opcional (endereço, sala)
    - notes: Observações do profissional
    - status: scheduled, done, canceled
    - created_at/updated_at
    """

    class VisitType(models.TextChoices):
        AVALIACAO = "avaliacao", "Avaliação"
        RETORNO = "retorno", "Retorno"
        PROCEDIMENTO = "procedimento", "Procedimento"
        OUTRO = "outro", "Outro"
        CONSULTA = "consulta", "Consulta"

    class Status(models.TextChoices):
        SCHEDULED = "scheduled", "Agendado"
        DONE = "done", "Realizado"
        CANCELED = "canceled", "Cancelado"

    professional = models.ForeignKey(
        "register.Professional",
        on_delete=models.CASCADE,
        related_name="appointments",
        verbose_name="Profissional",
    )
    client = models.ForeignKey(
        "clients.Client",
        on_delete=models.CASCADE,
        related_name="appointments",
        verbose_name="Cliente",
    )

    title = models.CharField("Título", max_length=80)
    visit_type = models.CharField(
        "Tipo de consulta",
        max_length=20,
        choices=VisitType.choices,
        default=VisitType.CONSULTA,
    )

    start_at = models.DateTimeField("Início")
    end_at = models.DateTimeField("Fim")

    location = models.CharField("Local", max_length=120, blank=True)
    notes = models.TextField("Observações", blank=True)
    status = models.CharField(
        "Status", max_length=12, choices=Status.choices, default=Status.SCHEDULED
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Timestamp real de conclusão (finalize) e de cancelamento
    # Mantidos separados para permitir auditoria distinta: quando finalizou vs quando cancelou.
    # Ambos opcionais; somente definidos na primeira ocorrência para preservar histórico.
    finalized_at = models.DateTimeField(
        blank=True,
        null=True,
        help_text="Momento em que o compromisso foi marcado como concluído (primeira vez).",
    )
    canceled_at = models.DateTimeField(
        blank=True,
        null=True,
        help_text="Momento em que o compromisso foi cancelado (primeira vez).",
    )

    # Dispositivo que criou e que finalizou (opcional)
    created_device_id = models.CharField(
        max_length=64, blank=True, null=True, help_text="Identificador do dispositivo que criou o compromisso"
    )
    created_device_info = models.TextField(blank=True, help_text="Informações técnicas do dispositivo (JSON) de criação")
    ended_device_id = models.CharField(
        max_length=64, blank=True, null=True, help_text="Identificador do dispositivo que finalizou o compromisso"
    )
    ended_device_info = models.TextField(blank=True, help_text="Informações técnicas do dispositivo (JSON) de finalização")

    class Meta:
        indexes = [
            models.Index(fields=["professional", "start_at"]),
            models.Index(fields=["client", "start_at"]),
            models.Index(fields=["status"]),
            models.Index(fields=["created_device_id"]),
            models.Index(fields=["ended_device_id"]),
            models.Index(fields=["finalized_at"]),
            models.Index(fields=["canceled_at"]),
        ]
        ordering = ["start_at"]

    def clean(self):
        # validações simples
        if self.end_at <= self.start_at:
            raise ValidationError({"end_at": "Fim deve ser após o início."})
        # status cancelado não tem regra extra aqui; lógica adicional pode ir no viewset

    def overlaps(self):
        """Verifica se conflita com outro agendamento do mesmo profissional.
        Critério: [start, end) com mesmo profissional e status diferente de canceled.
        """
        qs = (
            Appointment.objects.filter(professional=self.professional)
            .exclude(pk=self.pk)
            .exclude(status=Appointment.Status.CANCELED)
            .filter(start_at__lt=self.end_at, end_at__gt=self.start_at)
        )
        return qs.exists()

    def __str__(self):
        when = timezone.localtime(self.start_at).strftime("%d/%m %H:%M") if self.start_at else "?"
        return f"{self.title} — {self.client} ({when})"


class FinalizeAudit(models.Model):
    """Auditoria de finalização de compromissos."""

    appointment = models.ForeignKey(
        Appointment, on_delete=models.CASCADE, related_name="finalize_audits"
    )
    professional = models.ForeignKey(
        "register.Professional", on_delete=models.CASCADE, related_name="finalize_audits"
    )
    client = models.ForeignKey(
        "clients.Client", on_delete=models.CASCADE, related_name="finalize_audits"
    )

    device_id = models.CharField(max_length=64, blank=True, null=True)
    device_info = models.TextField(blank=True)
    client_now = models.DateTimeField(blank=True, null=True)
    server_now = models.DateTimeField()
    drift_ms = models.IntegerField(blank=True, null=True)
    adjusted_times = models.BooleanField(default=False)
    reason = models.CharField(max_length=32, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["appointment", "created_at"]),
            models.Index(fields=["professional", "created_at"]),
            models.Index(fields=["client", "created_at"]),
            models.Index(fields=["device_id"]),
        ]
        ordering = ["-created_at"]
