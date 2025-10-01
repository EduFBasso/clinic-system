from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from datetime import timedelta
from apps.register.models import Professional, Client
from apps.agenda.models import Appointment


class Command(BaseCommand):
    help = "Seed finalized appointments (consultations) for Odoo integration testing."

    def add_arguments(self, parser):
        parser.add_argument("email", type=str, help="Professional email to own the seeded appointments")
        parser.add_argument("--days", type=int, default=3, help="How many recent days to generate (default: 3)")
        parser.add_argument("--per_day", type=int, default=4, help="How many appointments per day (default: 4)")
        parser.add_argument("--client", type=int, default=None, help="Client id to reuse; if omitted, a demo client is created")

    def handle(self, *args, **options):
        email = options["email"].strip()
        days = options["days"]
        per_day = options["per_day"]
        client_id = options["client"]

        try:
            pro = Professional.objects.get(email__iexact=email)
        except Professional.DoesNotExist:
            raise CommandError(f"Professional with email {email} not found")

        if client_id:
            try:
                client = Client.objects.get(id=client_id, professional=pro)
            except Client.DoesNotExist:
                raise CommandError(f"Client id={client_id} not found for this professional")
        else:
            client, _ = Client.objects.get_or_create(
                professional=pro,
                email=f"demo.client+{pro.id}@example.com",
                defaults={
                    "first_name": "Cliente",
                    "last_name": "Demo",
                    "phone": "0000000000",
                },
            )

        visit_types = [
            Appointment.VisitType.CONSULTA,
            Appointment.VisitType.AVALIACAO,
            Appointment.VisitType.PROCEDIMENTO,
            Appointment.VisitType.RETORNO,
            Appointment.VisitType.OUTRO,
        ]

        now = timezone.now()
        total = 0
        for d in range(days):
            day = now - timedelta(days=d)
            base = day.replace(hour=9, minute=0, second=0, microsecond=0)
            for i in range(per_day):
                vt = visit_types[i % len(visit_types)]
                start = base + timedelta(minutes=i * 60)
                end = start + timedelta(minutes=40)
                appt = Appointment.objects.create(
                    professional=pro,
                    client=client,
                    title=vt.capitalize(),
                    visit_type=vt,
                    start_at=start,
                    end_at=end,
                    status=Appointment.Status.DONE,
                    notes=f"Seeded {vt} on {start.date().isoformat()}",
                )
                total += 1

        self.stdout.write(self.style.SUCCESS(f"Seeded {total} finalized appointments for {email} (client={client.id})"))
