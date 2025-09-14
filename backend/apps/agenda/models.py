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
        "register.Client",
        on_delete=models.CASCADE,
        related_name="appointments",
        verbose_name="Cliente",
    )

    title = models.CharField("Título", max_length=80)
    # NOTE: default alterado para CONSULTA (antes AVALIACAO). Gerar migração correspondente.
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

    class Meta:
        indexes = [
            models.Index(fields=["professional", "start_at"]),
            models.Index(fields=["client", "start_at"]),
            models.Index(fields=["status"]),
        ]
        ordering = ["start_at"]

    def clean(self):
        # validações simples
        if self.end_at <= self.start_at:
            from django.core.exceptions import ValidationError

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
