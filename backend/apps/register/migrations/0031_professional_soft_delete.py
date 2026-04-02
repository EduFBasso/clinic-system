# Generated manually for soft delete fields
from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ("register", "0030_professionalsettings"),
    ]

    operations = [
        migrations.AddField(
            model_name="professional",
            name="deactivated_at",
            field=models.DateTimeField(null=True, blank=True, verbose_name="Desativado em"),
        ),
        migrations.AddField(
            model_name="professional",
            name="deactivation_reason",
            field=models.CharField(max_length=120, blank=True, verbose_name="Motivo desativação"),
        ),
    ]
