import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('odonto', '0003_add_is_product_field'),
    ]

    operations = [
        migrations.AddField(
            model_name='procedure',
            name='parent_procedure',
            field=models.ForeignKey(
                blank=True,
                help_text='Procedimento pai ao qual este produto esta vinculado.',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='products',
                to='odonto.procedure',
            ),
        ),
    ]
