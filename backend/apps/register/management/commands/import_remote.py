import json
from typing import Optional, Tuple, Dict, Any, List

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
import requests

from apps.register.models import Client, Professional


def normalize_phone_digits(phone: Optional[str]) -> Optional[str]:
    if not phone:
        return None
    return ''.join(ch for ch in phone if ch.isdigit()) or None


class Command(BaseCommand):
    help = "Importa clientes do ambiente remoto para a base local via API, fazendo upsert por telefone/e-mail."

    def add_arguments(self, parser):
        parser.add_argument('--api-base', required=True, help='URL base da API remota, ex: https://api.exemplo.com')
        parser.add_argument('--email', help='E-mail do profissional para autenticação OTP (se token não fornecido)')
        parser.add_argument('--otp', help='Código OTP (quatro dígitos) se já recebido')
        parser.add_argument('--token', help='JWT já obtido (pula fluxo OTP)')
        parser.add_argument('--dry-run', action='store_true', help='Não grava no banco, apenas simula')
        parser.add_argument('--limit', type=int, default=0, help='Limite de clientes a importar (0 = todos)')

    def handle(self, *args, **options):
        api_base: str = options['api_base'].rstrip('/')
        token: Optional[str] = options.get('token')
        email: Optional[str] = options.get('email')
        otp: Optional[str] = options.get('otp')
        dry_run: bool = options['dry_run']
        limit: int = options['limit']

        if not token and not email:
            raise CommandError('Forneça --token ou --email para autenticar na API remota.')

        session = requests.Session()
        session.headers.update({'Content-Type': 'application/json'})

        # 1) Autenticação
        if not token:
            self.stdout.write(self.style.NOTICE('Solicitando código OTP...'))
            r = session.post(f'{api_base}/register/auth/request-code/', json={'email': email})
            if r.status_code != 200:
                raise CommandError(f'Falha ao solicitar código OTP: {r.status_code} {r.text}')
            if not otp:
                raise CommandError('Código OTP não informado. Use --otp após recebê-lo por e-mail/SMS.')
            self.stdout.write(self.style.NOTICE('Validando código OTP...'))
            r = session.post(f'{api_base}/register/auth/verify-code/', json={'email': email, 'code': otp})
            if r.status_code != 200:
                raise CommandError(f'Falha ao validar OTP: {r.status_code} {r.text}')
            data = r.json()
            token = data.get('access')
            if not token:
                raise CommandError('Token não recebido na validação do OTP.')

        session.headers.update({'Authorization': f'Bearer {token}'})

        # 2) Descobrir profissional logado (opcional, para log)
        try:
            prof_email = email or 'desconhecido'
        except Exception:
            prof_email = 'desconhecido'

        # 3) Buscar clientes básicos (paginando se necessário)
        url = f'{api_base}/register/clients-basic/'
        fetched: List[Dict[str, Any]] = []
        self.stdout.write(self.style.NOTICE(f'Buscando clientes em {url} ...'))
        r = session.get(url)
        if r.status_code == 200:
            body = r.json()
            # ViewSet não está paginado por DRF padrão; se estiver, detectar
            if isinstance(body, dict) and 'results' in body:
                fetched.extend(body.get('results') or [])
                next_url = body.get('next')
                while next_url:
                    r = session.get(next_url)
                    if r.status_code != 200:
                        raise CommandError(f'Erro ao paginar: {r.status_code} {r.text}')
                    body = r.json()
                    fetched.extend(body.get('results') or [])
                    next_url = body.get('next')
            elif isinstance(body, list):
                fetched = body
            else:
                raise CommandError('Resposta inesperada da API de clients-basic.')
        else:
            raise CommandError(f'Erro ao buscar clientes: {r.status_code} {r.text}')

        if limit and len(fetched) > limit:
            fetched = fetched[:limit]

        self.stdout.write(self.style.NOTICE(f'Total recebido: {len(fetched)}'))

        # 4) Upsert no banco local
        created = 0
        updated = 0
        skipped = 0

        # Obtém profissional local que fará a posse dos clientes (o usuário logado localmente)
        # Estratégia: se houver exatamente um Professional ativo local, usar; senão, escolher o primeiro superuser ativo
        local_prof: Optional[Professional] = Professional.objects.filter(is_active=True).order_by('-is_superuser', 'id').first()
        if not local_prof:
            raise CommandError('Nenhum Professional ativo encontrado na base local para associar clientes.')

        @transaction.atomic
        def import_batch(items: List[Dict[str, Any]]):
            nonlocal created, updated, skipped
            for item in items:
                # Campos esperados do serializer básico
                first_name = (item.get('first_name') or '').strip()
                last_name = (item.get('last_name') or '').strip()
                email_remote = (item.get('email') or '').strip().lower() or None
                phone_digits = normalize_phone_digits(item.get('phone'))
                address = item.get('address') or None
                neighborhood = item.get('neighborhood') or None
                city = item.get('city') or None
                state = item.get('state') or None

                if not first_name and not last_name and not phone_digits:
                    skipped += 1
                    continue

                # Dedupe por telefone; fallback para e-mail
                qs = Client.objects.filter(professional=local_prof)
                existing = None
                if phone_digits:
                    existing = qs.filter(phone=phone_digits).first()
                if not existing and email_remote:
                    existing = qs.filter(email=email_remote).first()

                if existing:
                    changed = False
                    # Atualiza campos não vazios
                    for field, value in {
                        'first_name': first_name or existing.first_name,
                        'last_name': last_name or existing.last_name,
                        'email': email_remote or existing.email,
                        'address': address if address is not None else existing.address,
                        'neighborhood': neighborhood if neighborhood is not None else existing.neighborhood,
                        'city': city if city is not None else existing.city,
                        'state': state if state is not None else existing.state,
                    }.items():
                        if getattr(existing, field) != value:
                            setattr(existing, field, value)
                            changed = True
                    if changed and not dry_run:
                        existing.save()
                    updated += 1 if changed else 0
                else:
                    if not phone_digits:
                        # Evita criar sem telefone (índice único/normalização)
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
                        )
                    created += 1

        import_batch(fetched)

        self.stdout.write(self.style.SUCCESS(
            f'Importação concluída (dry_run={dry_run}). Criados: {created}, Atualizados: {updated}, Ignorados: {skipped}'
        ))
