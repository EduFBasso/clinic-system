from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('register', '0021_alter_client_address'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='client',
            name='address_number',
        ),
        migrations.AddField(
            model_name='client',
            name='neighborhood',
            field=models.CharField('Bairro', max_length=100, null=True, blank=True),
        ),
    ]
