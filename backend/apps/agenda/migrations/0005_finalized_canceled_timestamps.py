from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("agenda", "0004_alter_finalizeaudit_options_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="appointment",
            name="finalized_at",
            field=models.DateTimeField(blank=True, null=True, help_text="Momento em que o compromisso foi marcado como concluído (primeira vez)."),
        ),
        migrations.AddField(
            model_name="appointment",
            name="canceled_at",
            field=models.DateTimeField(blank=True, null=True, help_text="Momento em que o compromisso foi cancelado (primeira vez)."),
        ),
        migrations.AddIndex(
            model_name="appointment",
            index=models.Index(fields=["finalized_at"], name="agenda_appo_finaliz_fts"),
        ),
        migrations.AddIndex(
            model_name="appointment",
            index=models.Index(fields=["canceled_at"], name="agenda_appo_cancelo_fts"),
        ),
    ]
