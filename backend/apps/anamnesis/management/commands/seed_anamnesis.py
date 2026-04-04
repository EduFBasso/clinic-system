"""
Management command: seed_anamnesis

Populates AnamnesisField records for a specific professional from a seed file.
Idempotent: uses get_or_create, safe to run multiple times.

Usage:
    python manage.py seed_anamnesis --professional-email=podologa@clinica.com
    python manage.py seed_anamnesis --professional-email=podologa@clinica.com --seed=podologia_unhas
    python manage.py seed_anamnesis --professional-email=podologa@clinica.com --dry-run
"""

import importlib

from django.core.management.base import BaseCommand, CommandError

from apps.anamnesis.models import AnamnesisField
from apps.register.models import Professional


class Command(BaseCommand):
    help = 'Popula campos de anamnese para um profissional a partir de um seed file'

    def add_arguments(self, parser):
        parser.add_argument(
            '--professional-email',
            required=True,
            help='E-mail do profissional que receberá os campos',
        )
        parser.add_argument(
            '--seed',
            default='podologia_unhas',
            help='Nome do módulo de seed em apps/anamnesis/seeds/ (default: podologia_unhas)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Mostra o que seria criado sem salvar no banco',
        )

    def handle(self, *args, **options):
        email = options['professional_email']
        seed_name = options['seed']
        dry_run = options['dry_run']

        # Resolve professional
        try:
            professional = Professional.objects.get(email=email)
        except Professional.DoesNotExist:
            raise CommandError(f'Profissional com e-mail "{email}" não encontrado.')

        self.stdout.write(
            self.style.SUCCESS(
                f'Profissional: {professional.first_name} {professional.last_name} (id={professional.pk})'
            )
        )

        # Load seed module
        try:
            module = importlib.import_module(f'apps.anamnesis.seeds.{seed_name}')
        except ModuleNotFoundError:
            raise CommandError(
                f'Seed "{seed_name}" não encontrado em apps/anamnesis/seeds/. '
                f'Crie o arquivo apps/anamnesis/seeds/{seed_name}.py'
            )

        sectors = getattr(module, 'SECTORS', None)
        if not sectors:
            raise CommandError(f'Seed "{seed_name}" não contém a lista SECTORS.')

        created_count = 0
        existing_count = 0

        for sector_block in sectors:
            sector = sector_block['sector']
            sector_order = sector_block['sector_order']

            for field_def in sector_block['fields']:
                if dry_run:
                    self.stdout.write(
                        f'  [dry-run] [{sector}] {field_def["label"]} '
                        f'({field_def["field_type"]})'
                    )
                    created_count += 1
                    continue

                obj, created = AnamnesisField.objects.get_or_create(
                    professional=professional,
                    sector=sector,
                    label=field_def['label'],
                    defaults={
                        'sector_order': sector_order,
                        'field_type': field_def['field_type'],
                        'options': field_def.get('options'),
                        'order': field_def['order'],
                        'is_active': True,
                    },
                )

                if created:
                    created_count += 1
                    self.stdout.write(f'  + [{sector}] {obj.label}')
                else:
                    # Atualiza options e order se houve mudança no seed
                    updated_fields = []
                    if obj.options != field_def.get('options'):
                        obj.options = field_def.get('options')
                        updated_fields.append('options')
                    if obj.order != field_def['order']:
                        obj.order = field_def['order']
                        updated_fields.append('order')
                    if obj.sector_order != sector_order:
                        obj.sector_order = sector_order
                        updated_fields.append('sector_order')
                    if updated_fields:
                        obj.save(update_fields=updated_fields)
                        self.stdout.write(f'  ↻ [{sector}] {obj.label} (atualizado: {", ".join(updated_fields)})')
                    else:
                        self.stdout.write(f'  ~ [{sector}] {obj.label} (já existia)')
                    existing_count += 1

        if dry_run:
            self.stdout.write(
                self.style.WARNING(f'\n[dry-run] {created_count} campos seriam criados.')
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f'\nConcluído: {created_count} criados, {existing_count} já existiam.'
                )
            )
