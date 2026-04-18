from django.db import migrations, models
import django.db.models.deletion
from django.utils.text import slugify


def populate_field_codes(apps, schema_editor):
    AnamnesisField = apps.get_model('anamnesis', 'AnamnesisField')

    for field in AnamnesisField.objects.order_by('professional_id', 'id'):
        base_code = slugify(field.label).replace('-', '_') or 'anamnesis_field'
        candidate = base_code
        suffix = 2
        while AnamnesisField.objects.filter(
            professional_id=field.professional_id,
            code=candidate,
        ).exclude(pk=field.pk).exists():
            candidate = f'{base_code}_{suffix}'
            suffix += 1
        field.code = candidate
        field.save(update_fields=['code'])


class Migration(migrations.Migration):

    dependencies = [
        ('anamnesis', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='anamnesisfield',
            name='code',
            field=models.SlugField(blank=True, default='', help_text='Identificador estável do campo para seeds, migrações e lógica de dependência.', max_length=120, verbose_name='Código'),
        ),
        migrations.AddField(
            model_name='anamnesisfield',
            name='depends_on',
            field=models.ForeignKey(blank=True, help_text='Campo pai que controla a visibilidade deste campo.', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='dependent_fields', to='anamnesis.anamnesisfield', verbose_name='Depende de'),
        ),
        migrations.AddField(
            model_name='anamnesisfield',
            name='placeholder',
            field=models.CharField(blank=True, default='', help_text='Texto de apoio opcional para campos text/textarea.', max_length=200, verbose_name='Placeholder'),
        ),
        migrations.AddField(
            model_name='anamnesisfield',
            name='show_when_value',
            field=models.CharField(blank=True, default='', help_text='Valor do campo pai que deve habilitar este campo. Vazio = qualquer valor não vazio.', max_length=100, verbose_name='Exibir quando valor for'),
        ),
        migrations.RunPython(populate_field_codes, migrations.RunPython.noop),
        migrations.AlterUniqueTogether(
            name='anamnesisfield',
            unique_together={('professional', 'code')},
        ),
    ]