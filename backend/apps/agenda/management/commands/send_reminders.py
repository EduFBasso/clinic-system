"""Management command: send push reminders for upcoming appointments.

Run this every minute via cron:
    * * * * * /path/to/.venv/bin/python manage.py send_reminders

For each professional with reminder_enabled=True, finds scheduled appointments
that start in approximately reminder_minutes_before minutes (±5 min window)
and haven't had a reminder sent yet, then pushes a notification to all
registered push subscriptions for that professional.

Expired/gone subscriptions (HTTP 404/410) are automatically removed.
"""
import json
import logging

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta

from apps.agenda.models import Appointment
from apps.register.models import ProfessionalSettings, PushSubscription

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Envia lembretes push para agendamentos próximos."

    def handle(self, *args, **kwargs):
        if not settings.VAPID_PRIVATE_KEY or not settings.VAPID_PUBLIC_KEY:
            self.stderr.write("VAPID keys not configured — skipping.")
            return

        # Import here so the command fails gracefully if pywebpush is not installed
        try:
            from pywebpush import webpush, WebPushException
        except ImportError:
            self.stderr.write("pywebpush is not installed. Run: pip install pywebpush")
            return

        now = timezone.now()

        prof_settings_qs = ProfessionalSettings.objects.filter(
            reminder_enabled=True
        ).select_related("professional")

        for prof_settings in prof_settings_qs:
            prof = prof_settings.professional
            reminder_min = prof_settings.reminder_minutes_before

            # Target window: appointments whose start_at is ~reminder_min from now.
            # Use a ±1-minute window to absorb cron jitter without firing too early.
            # The reminder_sent flag prevents duplicate sends.
            window_start = now + timedelta(minutes=reminder_min) - timedelta(minutes=1)
            window_end = now + timedelta(minutes=reminder_min) + timedelta(minutes=1)

            appointments = Appointment.objects.filter(
                professional=prof,
                status=Appointment.Status.SCHEDULED,
                start_at__gte=window_start,
                start_at__lte=window_end,
                reminder_sent=False,
            ).select_related("client")

            if not appointments.exists():
                continue

            subscriptions = list(PushSubscription.objects.filter(professional=prof))
            if not subscriptions:
                # Mark as sent to prevent repeated futile checks
                appointments.update(reminder_sent=True)
                continue

            for appt in appointments:
                client = appt.client
                client_name = (
                    f"{client.first_name} {client.last_name}".strip()
                    if hasattr(client, "first_name")
                    else str(client)
                )
                # Telefone para WhatsApp — remove caracteres não numéricos e garante DDI 55
                raw_phone = getattr(client, "phone", "") or ""
                digits = "".join(c for c in str(raw_phone) if c.isdigit())
                if digits and not digits.startswith("55"):
                    digits = "55" + digits

                visit_type_label = appt.get_visit_type_display()
                local_time = timezone.localtime(appt.start_at).strftime("%H:%M")

                # Nome de exibição da profissional (display_name preferido, fallback para first_name)
                prof_first_name = getattr(prof, "display_name", None) or getattr(prof, "first_name", "") or str(prof)

                # Mensagem WhatsApp pré-preenchida
                wa_text = (
                    f"Ol\u00e1 {client_name}, "
                    f"{visit_type_label} agendada para as {local_time} "
                    f"com {prof_first_name}, "
                    f"confirma sua presen\u00e7a?"
                )

                payload = json.dumps(
                    {
                        "title": f"Lembrete: {visit_type_label} \u00e0s {local_time}",
                        "body": f"{client_name} \u2014 deseja confirmar presen\u00e7a por WhatsApp?",
                        "appointment_id": appt.pk,
                        "wa_phone": digits,
                        "wa_text": wa_text,
                    }
                )

                stale_ids = []
                for sub in subscriptions:
                    try:
                        webpush(
                            subscription_info={
                                "endpoint": sub.endpoint,
                                "keys": {
                                    "p256dh": sub.p256dh,
                                    "auth": sub.auth,
                                },
                            },
                            data=payload,
                            vapid_private_key=settings.VAPID_PRIVATE_KEY,
                            vapid_claims={
                                "sub": f"mailto:{settings.VAPID_ADMIN_EMAIL}",
                            },
                        )
                    except WebPushException as exc:
                        resp = getattr(exc, "response", None)
                        if resp is not None and resp.status_code in (404, 410):
                            stale_ids.append(sub.pk)
                        else:
                            logger.error(
                                "Push failed for subscription %s: %s", sub.pk, exc
                            )

                if stale_ids:
                    PushSubscription.objects.filter(id__in=stale_ids).delete()
                    logger.info("Removed %d stale push subscription(s).", len(stale_ids))

                appt.reminder_sent = True
                appt.save(update_fields=["reminder_sent"])
                self.stdout.write(
                    f"Reminder sent for appointment {appt.pk} ({client_name} — {visit_type_label} às {local_time})"
                )
