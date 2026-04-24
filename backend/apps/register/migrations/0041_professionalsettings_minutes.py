from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('register', '0040_professional_display_name'),
    ]

    operations = [
        migrations.AddField(
            model_name='professionalsettings',
            name='work_end_minute',
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='professionalsettings',
            name='work_start_minute',
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AlterField(
            model_name='professionalsettings',
            name='slot_minutes',
            field=models.PositiveSmallIntegerField(default=10),
        ),
        migrations.AlterField(
            model_name='professionalsettings',
            name='work_end_hour',
            field=models.PositiveSmallIntegerField(default=21),
        ),
        migrations.AlterField(
            model_name='professionalsettings',
            name='work_start_hour',
            field=models.PositiveSmallIntegerField(default=6),
        ),
    ]