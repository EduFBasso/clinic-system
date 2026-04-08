"""Add whatsapp_confirmed field to Appointment."""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("agenda", "0009_appointment_reminder_sent"),
    ]

    operations = [
        migrations.AddField(
            model_name="appointment",
            name="whatsapp_confirmed",
            field=models.BooleanField(
                default=False,
                help_text="True quando o profissional abriu o WhatsApp para confirmar presença do cliente.",
            ),
        ),
    ]
