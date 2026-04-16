from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('register', '0041_professionalsettings_minutes'),
    ]

    operations = [
        migrations.AddField(
            model_name='professionalsettings',
            name='default_duration_minutes',
            field=models.PositiveSmallIntegerField(default=60),
        ),
        migrations.AddField(
            model_name='professionalsettings',
            name='default_visit_type',
            field=models.CharField(
                choices=[
                    ('consulta', 'Consulta'),
                    ('avaliacao', 'Avaliação'),
                    ('retorno', 'Retorno'),
                    ('procedimento', 'Procedimento'),
                    ('outro', 'Outro'),
                ],
                default='consulta',
                max_length=20,
            ),
        ),
    ]