"""
Management command: migrate_anamnesis_legacy

Reads the legacy anamnesis fields from apps.clients.models.Client and creates
AnamnesisResponse records for each non-empty value found.

Prerequisites:
    - seed_anamnesis must have been run first for this professional
      (AnamnesisField records must exist with matching labels)

Usage:
    python manage.py migrate_anamnesis_legacy --professional-email=podologa@clinica.com
    python manage.py migrate_anamnesis_legacy --professional-email=podologa@clinica.com --dry-run

After verifying results, the legacy columns on Client can be removed in a future migration (Phase 2).
"""

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.anamnesis.models import AnamnesisField, AnamnesisResponse
from apps.clients.models import Client
from apps.register.models import Professional


# Maps legacy Client field name → AnamnesisField label (must match seed exactly)
LEGACY_FIELD_MAP = [
    ('sport_activity',                      'Atividade esportiva'),
    ('academic_activity',                   'Atividade acadêmica'),
    ('takes_medication',                    'Toma medicação'),
    ('had_surgery',                         'Já fez cirurgia'),
    ('pain_sensitivity',                    'Sensibilidade à dor'),
    ('clinical_history',                    'Histórico clínico'),
    ('footwear_used',                       'Calçado utilizado'),
    ('sock_used',                           'Meia utilizada'),
    ('plantar_view_right',                  'Vista plantar direita'),
    ('dermatological_pathologies_right',    'Patologias dermatológicas direito'),
    ('nail_changes_right',                  'Alterações ungueais direito'),
    ('deformities_right',                   'Deformidades direito'),
    ('sensitivity_test',                    'Teste de sensibilidade direito'),
    ('plantar_view_left',                   'Vista plantar esquerda'),
    ('dermatological_pathologies_left',     'Patologias dermatológicas esquerdo'),
    ('nail_changes_left',                   'Alterações ungueais esquerdo'),
    ('deformities_left',                    'Deformidades esquerdo'),
    ('other_procedures',                    'Outros procedimentos'),
]

# is_pregnant is boolean — convert to 'Sim'/'Não'
IS_PREGNANT_LABEL = 'Está grávida'


class Command(BaseCommand):
    help = 'Migra dados de anamnese legados do modelo Client para AnamnesisResponse'

    def add_arguments(self, parser):
        parser.add_argument(
            '--professional-email',
            required=True,
            help='E-mail do profissional cujos clientes serão migrados',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Mostra o que seria criado sem salvar no banco',
        )

    def handle(self, *args, **options):
        email = options['professional_email']
        dry_run = options['dry_run']

        try:
            professional = Professional.objects.get(email=email)
        except Professional.DoesNotExist:
            raise CommandError(f'Profissional "{email}" não encontrado.')

        self.stdout.write(
            self.style.SUCCESS(
                f'Profissional: {professional.first_name} {professional.last_name} (id={professional.pk})'
            )
        )

        # Build label → AnamnesisField lookup for this professional
        fields_qs = AnamnesisField.objects.filter(professional=professional)
        field_by_label = {f.label: f for f in fields_qs}

        if not field_by_label:
            raise CommandError(
                'Nenhum AnamnesisField encontrado para este profissional. '
                'Execute seed_anamnesis primeiro.'
            )

        clients = Client.objects.filter(professional=professional)
        self.stdout.write(f'Clientes a migrar: {clients.count()}')

        total_created = 0
        total_skipped = 0
        total_empty = 0

        full_map = LEGACY_FIELD_MAP + [('is_pregnant', IS_PREGNANT_LABEL)]

        with transaction.atomic():
            for client in clients:
                for legacy_field, label in full_map:
                    raw_value = getattr(client, legacy_field, None)

                    # Normalize value to string
                    if raw_value is None or raw_value == '':
                        total_empty += 1
                        continue

                    if legacy_field == 'is_pregnant':
                        value = 'Sim' if raw_value else 'Não'
                    else:
                        value = str(raw_value).strip()
                        if not value:
                            total_empty += 1
                            continue

                    anamnesis_field = field_by_label.get(label)
                    if not anamnesis_field:
                        self.stdout.write(
                            self.style.WARNING(
                                f'  ! Campo "{label}" não encontrado no seed — pulando'
                            )
                        )
                        total_skipped += 1
                        continue

                    if dry_run:
                        self.stdout.write(
                            f'  [dry-run] {client} | {label}: {value[:60]}'
                        )
                        total_created += 1
                        continue

                    _, created = AnamnesisResponse.objects.get_or_create(
                        client=client,
                        field=anamnesis_field,
                        defaults={
                            'field_label_snap': anamnesis_field.label,
                            'value': value,
                        },
                    )
                    if created:
                        total_created += 1
                    else:
                        total_skipped += 1

            if dry_run:
                transaction.set_rollback(True)

        verb = '[dry-run] seriam criadas' if dry_run else 'criadas'
        self.stdout.write(
            self.style.SUCCESS(
                f'\nConcluído: {total_created} respostas {verb}, '
                f'{total_skipped} já existiam/puladas, '
                f'{total_empty} campos vazios ignorados.'
            )
        )
