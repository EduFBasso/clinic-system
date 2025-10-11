from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('register', '0033_client_photo'),
    ]

    operations = [
        migrations.AddField(
            model_name='professionalsettings',
            name='pix_key_type',
            field=models.CharField(blank=True, choices=[('telefone', 'Telefone'), ('cpf', 'CPF'), ('email', 'E-mail'), ('aleatoria', 'Aleatória')], default='', max_length=16),
        ),
        migrations.AddField(
            model_name='professionalsettings',
            name='pix_key_value',
            field=models.CharField(blank=True, default='', max_length=128),
        ),
    ]
