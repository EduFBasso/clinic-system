from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('odonto', '0004_procedure_parent_procedure'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ProcedureNameSuggestion',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('professional', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='odonto_procedure_name_suggestions', to=settings.AUTH_USER_MODEL, verbose_name='Profissional')),
            ],
            options={
                'verbose_name': 'Sugestao de nome de procedimento',
                'verbose_name_plural': 'Sugestoes de nomes de procedimento',
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='ProductCatalogItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255)),
                ('last_value', models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('professional', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='odonto_product_catalog_items', to=settings.AUTH_USER_MODEL, verbose_name='Profissional')),
            ],
            options={
                'verbose_name': 'Item de catalogo de produto',
                'verbose_name_plural': 'Itens de catalogo de produto',
                'ordering': ['name'],
            },
        ),
        migrations.AddIndex(
            model_name='procedurenamesuggestion',
            index=models.Index(fields=['professional', 'name'], name='odonto_proc_profess_5f8dd0_idx'),
        ),
        migrations.AddIndex(
            model_name='productcatalogitem',
            index=models.Index(fields=['professional', 'name'], name='odonto_prod_profess_7e05e7_idx'),
        ),
    ]
