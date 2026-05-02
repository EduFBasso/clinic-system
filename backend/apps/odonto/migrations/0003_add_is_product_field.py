# Generated migration for is_product field

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('odonto', '0002_procedure_paid_at'),
    ]

    operations = [
        migrations.AddField(
            model_name='procedure',
            name='is_product',
            field=models.BooleanField(
                default=False,
                help_text='Se True, é um produto/material; se False, é um procedimento'
            ),
        ),
        migrations.AddIndex(
            model_name='procedure',
            index=models.Index(fields=['arcade', 'is_product'], name='odonto_proc_arcade_is_produc_idx'),
        ),
    ]
