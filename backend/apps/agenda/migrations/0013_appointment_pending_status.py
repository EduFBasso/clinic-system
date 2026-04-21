from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("agenda", "0012_chargeitem_paid_paid_at"),
    ]

    operations = [
        migrations.AlterField(
            model_name="appointment",
            name="status",
            field=models.CharField(
                choices=[
                    ("scheduled", "Agendado"),
                    ("pending", "Pendente"),
                    ("done", "Realizado"),
                    ("canceled", "Cancelado"),
                ],
                default="scheduled",
                max_length=12,
                verbose_name="Status",
            ),
        ),
    ]