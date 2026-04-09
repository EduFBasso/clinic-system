from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("agenda", "0011_rename_agenda_charg_profess_a9145c_idx_agenda_char_profess_b69a39_idx_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="chargeitem",
            name="paid",
            field=models.BooleanField(default=False, verbose_name="Pago"),
        ),
        migrations.AddField(
            model_name="chargeitem",
            name="paid_at",
            field=models.DateTimeField(blank=True, null=True, verbose_name="Pago em"),
        ),
    ]
