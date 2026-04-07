"""Add reminder_sent field to Appointment."""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("agenda", "0008_sprint1_domain_models"),
    ]

    operations = [
        migrations.AddField(
            model_name="appointment",
            name="reminder_sent",
            field=models.BooleanField(
                default=False,
                help_text="True quando o lembrete push do dia já foi enviado para este agendamento.",
            ),
        ),
    ]
