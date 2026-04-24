from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("agenda", "0010_appointment_whatsapp_confirmed"),
        ("register", "0042_professionalsettings_defaults"),
    ]

    operations = [
        migrations.CreateModel(
            name="TelegramProfessionalLink",
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
                ("chat_id", models.CharField(max_length=64, unique=True)),
                ("telegram_username", models.CharField(blank=True, max_length=64)),
                ("is_active", models.BooleanField(default=True)),
                ("linked_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("last_error", models.TextField(blank=True)),
                (
                    "professional",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="telegram_link",
                        to="register.professional",
                        verbose_name="Profissional",
                    ),
                ),
            ],
            options={
                "verbose_name": "Vínculo Telegram",
                "verbose_name_plural": "Vínculos Telegram",
            },
        ),
        migrations.CreateModel(
            name="ReminderDelivery",
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
                (
                    "channel",
                    models.CharField(
                        choices=[("telegram", "Telegram")],
                        default="telegram",
                        max_length=16,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("sent", "Enviado"),
                            ("failed", "Falhou"),
                            ("skipped", "Ignorado"),
                        ],
                        max_length=16,
                    ),
                ),
                ("attempted_at", models.DateTimeField(auto_now_add=True)),
                ("sent_at", models.DateTimeField(blank=True, null=True)),
                ("error_message", models.TextField(blank=True)),
                ("payload", models.JSONField(blank=True, default=dict)),
                ("response_payload", models.JSONField(blank=True, default=dict)),
                ("external_message_id", models.CharField(blank=True, max_length=64)),
                (
                    "appointment",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="reminder_deliveries",
                        to="agenda.appointment",
                    ),
                ),
                (
                    "professional",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="reminder_deliveries",
                        to="register.professional",
                    ),
                ),
            ],
            options={
                "verbose_name": "Entrega de lembrete",
                "verbose_name_plural": "Entregas de lembretes",
            },
        ),
        migrations.AddIndex(
            model_name="reminderdelivery",
            index=models.Index(fields=["professional", "attempted_at"], name="reminders_r_profess_84466c_idx"),
        ),
        migrations.AddIndex(
            model_name="reminderdelivery",
            index=models.Index(fields=["appointment", "channel"], name="reminders_r_appoint_b22877_idx"),
        ),
        migrations.AddIndex(
            model_name="reminderdelivery",
            index=models.Index(fields=["status", "attempted_at"], name="reminders_r_status_25b008_idx"),
        ),
    ]