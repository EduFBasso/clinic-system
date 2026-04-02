import csv
from typing import Optional, Dict, Any, List

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.register.models import Client, Professional


def normalize_phone_digits(phone: Optional[str]) -> Optional[str]:
    if not phone:
        return None
    digits = ''.join(ch for ch in str(phone) if ch.isdigit())
    return digits or None


class Command(BaseCommand):
    help = (
        "Importa clientes de um arquivo CSV para a base local, com upsert por telefone (fallback e-mail).\n"
        "Aceita colunas extras quando presentes: profession, postal_code, footwear_used, sock_used,\n"
        "sport_activity, academic_activity, takes_medication, had_surgery, is_pregnant, pain_sensitivity,\n"
        "clinical_history, plantar_view_left, plantar_view_right, dermatological_pathologies_left,\n"
        "dermatological_pathologies_right, nail_changes_left, nail_changes_right, deformities_left,\n"
        "deformities_right, sensitivity_test, other_procedures."
    )

    def add_arguments(self, parser):
        parser.add_argument('--file', required=True, help='Caminho do CSV a importar')
        parser.add_argument('--local-professional-email', help='E-mail do Professional local que será dono dos clientes')
        parser.add_argument('--limit', type=int, default=0, help='Limite de linhas a processar (0=todas)')
        parser.add_argument('--dry-run', action='store_true', help='Simula sem gravar no banco')

    def handle(self, *args, **options):
        file_path: str = options['file']
        target_email: Optional[str] = options.get('local_professional_email')
        limit: int = options.get('limit') or 0
        dry_run: bool = bool(options.get('dry_run'))

        # Seleciona o Professional local de destino
        local_prof: Optional[Professional] = None
        if target_email:
            local_prof = Professional.objects.filter(email=target_email, is_active=True).first()
            if not local_prof:
                raise CommandError(f'Professional local com e-mail {target_email} não encontrado/ativo.')
        else:
            local_prof = Professional.objects.filter(is_active=True).order_by('-is_superuser', 'id').first()
            if not local_prof:
                raise CommandError('Nenhum Professional ativo encontrado para associar clientes.')

        self.stdout.write(self.style.NOTICE(f'Importando para o Professional local: {local_prof.email} (id={local_prof.id})'))

        # Lê CSV
        rows: List[Dict[str, Any]] = []
        with open(file_path, newline='', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            expected = {
                'first_name','last_name','email','phone','address','neighborhood','city','state',
                # opcionais suportados
                'profession','postal_code','footwear_used','sock_used','sport_activity','academic_activity',
                'takes_medication','had_surgery','is_pregnant','pain_sensitivity','clinical_history',
                'plantar_view_left','plantar_view_right','dermatological_pathologies_left','dermatological_pathologies_right',
                'nail_changes_left','nail_changes_right','deformities_left','deformities_right','sensitivity_test','other_procedures',
            }
            header = set(reader.fieldnames or [])
            missing = expected - header
            if missing:
                self.stdout.write(self.style.WARNING(
                    f'CSV não contém colunas esperadas: {", ".join(sorted(missing))}. Prosseguindo com o que houver.'
                ))
            for i, row in enumerate(reader):
                rows.append(row)
                if limit and len(rows) >= limit:
                    break

        self.stdout.write(self.style.NOTICE(f'Total de linhas lidas: {len(rows)}'))

        created = 0
        updated = 0
        skipped = 0

        def parse_bool(value: Optional[str]) -> Optional[bool]:
            if value is None:
                return None
            s = str(value).strip().lower()
            if s in {'true','1','yes','y','sim'}:
                return True
            if s in {'false','0','no','n','nao','não'}:
                return False
            return None

        @transaction.atomic
        def import_batch(items: List[Dict[str, Any]]):
            nonlocal created, updated, skipped
            for item in items:
                first_name = (item.get('first_name') or '').strip()
                last_name = (item.get('last_name') or '').strip()
                email_remote = (item.get('email') or '').strip().lower() or None
                phone_digits = normalize_phone_digits(item.get('phone'))
                address = (item.get('address') or None) or None
                neighborhood = (item.get('neighborhood') or None) or None
                city = (item.get('city') or None) or None
                state = (item.get('state') or None) or None

                # opcionais
                profession = (item.get('profession') or None) or None
                postal_code = (item.get('postal_code') or None) or None
                footwear_used = (item.get('footwear_used') or None) or None
                sock_used = (item.get('sock_used') or None) or None
                sport_activity = (item.get('sport_activity') or None) or None
                academic_activity = (item.get('academic_activity') or None) or None
                takes_medication = (item.get('takes_medication') or None) or None
                had_surgery = (item.get('had_surgery') or None) or None
                is_pregnant = parse_bool(item.get('is_pregnant'))
                pain_sensitivity = (item.get('pain_sensitivity') or None) or None
                clinical_history = (item.get('clinical_history') or None) or None
                plantar_view_left = (item.get('plantar_view_left') or None) or None
                plantar_view_right = (item.get('plantar_view_right') or None) or None
                dermatological_pathologies_left = (item.get('dermatological_pathologies_left') or None) or None
                dermatological_pathologies_right = (item.get('dermatological_pathologies_right') or None) or None
                nail_changes_left = (item.get('nail_changes_left') or None) or None
                nail_changes_right = (item.get('nail_changes_right') or None) or None
                deformities_left = (item.get('deformities_left') or None) or None
                deformities_right = (item.get('deformities_right') or None) or None
                sensitivity_test = (item.get('sensitivity_test') or None) or None
                other_procedures = (item.get('other_procedures') or None) or None

                if not first_name and not last_name and not phone_digits:
                    skipped += 1
                    continue

                # Busca GLOBAL por telefone/e-mail (evita violar unicidade e permite reatribuir ao profissional alvo)
                existing = None
                if phone_digits:
                    existing = Client.objects.filter(phone=phone_digits).first()
                if not existing and email_remote:
                    existing = Client.objects.filter(email=email_remote).first()

                if existing:
                    changed = False
                    updates = {
                        'professional': local_prof if existing.professional_id != local_prof.id else existing.professional,
                        'first_name': first_name or existing.first_name,
                        'last_name': last_name or existing.last_name,
                        'email': email_remote or existing.email,
                        'address': address if address is not None else existing.address,
                        'neighborhood': neighborhood if neighborhood is not None else existing.neighborhood,
                        'city': city if city is not None else existing.city,
                        'state': state if state is not None else existing.state,
                        'profession': profession if profession is not None else existing.profession,
                        'postal_code': postal_code if postal_code is not None else existing.postal_code,
                        'footwear_used': footwear_used if footwear_used is not None else existing.footwear_used,
                        'sock_used': sock_used if sock_used is not None else existing.sock_used,
                        'sport_activity': sport_activity if sport_activity is not None else existing.sport_activity,
                        'academic_activity': academic_activity if academic_activity is not None else existing.academic_activity,
                        'takes_medication': takes_medication if takes_medication is not None else existing.takes_medication,
                        'had_surgery': had_surgery if had_surgery is not None else existing.had_surgery,
                        'is_pregnant': is_pregnant if is_pregnant is not None else existing.is_pregnant,
                        'pain_sensitivity': pain_sensitivity if pain_sensitivity is not None else existing.pain_sensitivity,
                        'clinical_history': clinical_history if clinical_history is not None else existing.clinical_history,
                        'plantar_view_left': plantar_view_left if plantar_view_left is not None else existing.plantar_view_left,
                        'plantar_view_right': plantar_view_right if plantar_view_right is not None else existing.plantar_view_right,
                        'dermatological_pathologies_left': dermatological_pathologies_left if dermatological_pathologies_left is not None else existing.dermatological_pathologies_left,
                        'dermatological_pathologies_right': dermatological_pathologies_right if dermatological_pathologies_right is not None else existing.dermatological_pathologies_right,
                        'nail_changes_left': nail_changes_left if nail_changes_left is not None else existing.nail_changes_left,
                        'nail_changes_right': nail_changes_right if nail_changes_right is not None else existing.nail_changes_right,
                        'deformities_left': deformities_left if deformities_left is not None else existing.deformities_left,
                        'deformities_right': deformities_right if deformities_right is not None else existing.deformities_right,
                        'sensitivity_test': sensitivity_test if sensitivity_test is not None else existing.sensitivity_test,
                        'other_procedures': other_procedures if other_procedures is not None else existing.other_procedures,
                    }
                    for field, value in updates.items():
                        if getattr(existing, field) != value:
                            setattr(existing, field, value)
                            changed = True
                    if changed and not dry_run:
                        existing.save()
                    updated += 1 if changed else 0
                else:
                    if not phone_digits:
                        skipped += 1
                        continue
                    if not dry_run:
                        Client.objects.create(
                            professional=local_prof,
                            first_name=first_name or 'Cliente',
                            last_name=last_name or '',
                            email=email_remote,
                            phone=phone_digits,
                            address=address,
                            neighborhood=neighborhood,
                            city=city,
                            state=state,
                            profession=profession,
                            postal_code=postal_code,
                            footwear_used=footwear_used,
                            sock_used=sock_used,
                            sport_activity=sport_activity,
                            academic_activity=academic_activity,
                            takes_medication=takes_medication,
                            had_surgery=had_surgery,
                            is_pregnant=is_pregnant,
                            pain_sensitivity=pain_sensitivity,
                            clinical_history=clinical_history,
                            plantar_view_left=plantar_view_left,
                            plantar_view_right=plantar_view_right,
                            dermatological_pathologies_left=dermatological_pathologies_left,
                            dermatological_pathologies_right=dermatological_pathologies_right,
                            nail_changes_left=nail_changes_left,
                            nail_changes_right=nail_changes_right,
                            deformities_left=deformities_left,
                            deformities_right=deformities_right,
                            sensitivity_test=sensitivity_test,
                            other_procedures=other_procedures,
                        )
                    created += 1

        import_batch(rows)

        self.stdout.write(self.style.SUCCESS(
            f'Importação CSV concluída (dry_run={dry_run}). Criados: {created}, Atualizados: {updated}, Ignorados: {skipped}'
        ))
