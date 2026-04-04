from django.db import models


class AnamnesisField(models.Model):
    """
    Defines a question/field in the anamnesis form for a specific professional.
    Each professional has their own set of fields, grouped by sector.
    """

    FIELD_TYPE_CHOICES = [
        ('radio', 'Radio buttons'),
        ('text', 'Texto livre'),
        ('textarea', 'Texto longo'),
    ]

    professional = models.ForeignKey(
        'register.Professional',
        on_delete=models.CASCADE,
        related_name='anamnesis_fields',
        verbose_name='Profissional',
    )
    sector = models.CharField(
        'Setor',
        max_length=100,
        help_text='Agrupa visualmente os campos — ex: "Histórico", "Pé Direito"',
    )
    sector_order = models.PositiveSmallIntegerField(
        'Ordem do setor',
        default=0,
        help_text='Ordem de exibição do setor na tela',
    )
    label = models.CharField('Pergunta', max_length=200)
    field_type = models.CharField(
        'Tipo',
        max_length=10,
        choices=FIELD_TYPE_CHOICES,
        default='radio',
    )
    options = models.JSONField(
        'Opções',
        null=True,
        blank=True,
        help_text='Lista de strings para radio buttons. Null para text/textarea.',
    )
    order = models.PositiveSmallIntegerField(
        'Ordem dentro do setor',
        default=0,
    )
    is_active = models.BooleanField(
        'Ativo',
        default=True,
        help_text='Desativar em vez de apagar preserva respostas históricas.',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = 'anamnesis'
        ordering = ['sector_order', 'order']
        verbose_name = 'Campo de anamnese'
        verbose_name_plural = 'Campos de anamnese'

    def __str__(self):
        return f'[{self.sector}] {self.label} ({self.professional})'


class AnamnesisResponse(models.Model):
    """
    Records a patient's answer to one anamnesis field at a point in time.
    field_label_snap preserves the question text even if the field is later renamed/deleted.
    """

    client = models.ForeignKey(
        'clients.Client',
        on_delete=models.CASCADE,
        related_name='anamnesis_responses',
        verbose_name='Cliente',
    )
    field = models.ForeignKey(
        AnamnesisField,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='responses',
        verbose_name='Campo',
    )
    field_label_snap = models.CharField(
        'Pergunta (snapshot)',
        max_length=200,
        help_text='Cópia do label no momento da resposta.',
    )
    value = models.TextField('Resposta', blank=True, default='')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'anamnesis'
        # One response per client per field
        unique_together = [('client', 'field')]
        verbose_name = 'Resposta de anamnese'
        verbose_name_plural = 'Respostas de anamnese'

    def __str__(self):
        field_info = self.field_label_snap or (str(self.field) if self.field else 'campo excluído')
        return f'{self.client} — {field_info}: {self.value[:40]}'


class AnamnesisPhoto(models.Model):
    """
    Optional photos attached to an anamnesis response (e.g. foot photos).
    """

    response = models.ForeignKey(
        AnamnesisResponse,
        on_delete=models.CASCADE,
        related_name='photos',
        verbose_name='Resposta',
    )
    image = models.ImageField(
        'Foto',
        upload_to='anamnesis_photos/',
    )
    caption = models.CharField('Legenda', max_length=200, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = 'anamnesis'
        verbose_name = 'Foto de anamnese'
        verbose_name_plural = 'Fotos de anamnese'

    def __str__(self):
        return f'Foto de {self.response} em {self.uploaded_at:%d/%m/%Y}'
