from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("register", "0023_alter_client_neighborhood"),
    ]

    operations = [
        migrations.AlterField(
            model_name="client",
            name="takes_medication",
            field=models.CharField(
                verbose_name="Toma medicação",
                max_length=255,
                null=True,
                blank=True,
            ),
        ),
        migrations.AlterField(
            model_name="client",
            name="had_surgery",
            field=models.CharField(
                verbose_name="Já fez cirurgia",
                max_length=255,
                null=True,
                blank=True,
            ),
        ),
    ]
