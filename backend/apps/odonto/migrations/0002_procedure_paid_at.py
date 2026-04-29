from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('odonto', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='procedure',
            name='paid_at',
            field=models.DateField(blank=True, null=True),
        ),
    ]
