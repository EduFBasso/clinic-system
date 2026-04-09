"""Add PushSubscription model and reminder fields to ProfessionalSettings."""
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("register", "0038_remove_client_state"),
    ]

    operations = [
        # New fields on ProfessionalSettings
        migrations.AddField(
            model_name="professionalsettings",
            name="reminder_enabled",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="professionalsettings",
            name="reminder_minutes_before",
            field=models.PositiveSmallIntegerField(
                default=90,
                help_text="Quantos minutos antes do compromisso enviar o lembrete push.",
            ),
        ),
        # New PushSubscription model
        migrations.CreateModel(
            name="PushSubscription",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("endpoint", models.TextField(unique=True)),
                ("p256dh", models.TextField()),
                ("auth", models.TextField()),
                ("user_agent", models.CharField(blank=True, max_length=256)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "professional",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="push_subscriptions",
                        to="register.professional",
                        verbose_name="Profissional",
                    ),
                ),
            ],
            options={
                "verbose_name": "Assinatura Push",
                "verbose_name_plural": "Assinaturas Push",
            },
        ),
    ]
