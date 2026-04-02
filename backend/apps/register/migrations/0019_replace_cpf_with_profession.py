from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ('register', '0018_client_deformities_left_client_deformities_right_and_more'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='client',
            name='cpf',
        ),
        migrations.AddField(
            model_name='client',
            name='profession',
            field=models.CharField(max_length=100, null=True, blank=True, verbose_name='Profissão'),
        ),
    ]
