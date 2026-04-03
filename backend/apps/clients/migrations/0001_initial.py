"""Move Client model from register to clients app.

Uses SeparateDatabaseAndState so the physical table (register_client) is
preserved unchanged — only Django's migration state is updated.
"""
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('register', '0037_delete_accesscode'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.CreateModel(
                    name='Client',
                    fields=[
                        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('first_name', models.CharField(max_length=255, verbose_name='Primeiro nome')),
                        ('last_name', models.CharField(max_length=255, verbose_name='Sobrenome')),
                        ('email', models.EmailField(blank=True, max_length=254, null=True, unique=True, verbose_name='E-mail')),
                        ('phone', models.CharField(max_length=20, null=True, unique=True, verbose_name='Telefone')),
                        ('profession', models.CharField(blank=True, max_length=100, null=True, verbose_name='Profissão')),
                        ('address', models.CharField(blank=True, max_length=255, null=True, verbose_name='Endereço')),
                        ('neighborhood', models.CharField(blank=True, max_length=100, null=True, verbose_name='Bairro')),
                        ('city', models.CharField(blank=True, max_length=100, null=True, verbose_name='Cidade')),
                        ('state', models.CharField(blank=True, max_length=2, null=True, verbose_name='Estado')),
                        ('postal_code', models.CharField(blank=True, max_length=20, null=True, verbose_name='CEP')),
                        ('date_of_birth', models.DateField(blank=True, null=True, verbose_name='Data de nascimento')),
                        ('address_number', models.CharField(blank=True, max_length=16, null=True, verbose_name='Número')),
                        ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Criado em')),
                        ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Atualizado em')),
                        ('footwear_used', models.CharField(blank=True, max_length=50, null=True, verbose_name='Calçado usado')),
                        ('sock_used', models.CharField(blank=True, max_length=50, null=True, verbose_name='Meia usada')),
                        ('sport_activity', models.CharField(blank=True, max_length=50, null=True, verbose_name='Atividade esportiva')),
                        ('academic_activity', models.CharField(blank=True, max_length=50, null=True, verbose_name='Atividade acadêmica')),
                        ('takes_medication', models.CharField(blank=True, max_length=255, null=True, verbose_name='Toma medicação')),
                        ('had_surgery', models.CharField(blank=True, max_length=255, null=True, verbose_name='Já fez cirurgia')),
                        ('is_pregnant', models.BooleanField(blank=True, null=True, verbose_name='Está grávida')),
                        ('pain_sensitivity', models.CharField(blank=True, max_length=50, null=True, verbose_name='Sensibilidade à dor')),
                        ('clinical_history', models.TextField(blank=True, null=True, verbose_name='Histórico clínico')),
                        ('plantar_view_left', models.TextField(blank=True, null=True, verbose_name='Vista plantar esquerda')),
                        ('plantar_view_right', models.TextField(blank=True, null=True, verbose_name='Vista plantar direita')),
                        ('dermatological_pathologies_left', models.TextField(blank=True, null=True, verbose_name='Patologias pé esquerdo')),
                        ('dermatological_pathologies_right', models.TextField(blank=True, null=True, verbose_name='Patologias pé direito')),
                        ('nail_changes_left', models.TextField(blank=True, null=True, verbose_name='Alterações nas unhas pé esquerdo')),
                        ('nail_changes_right', models.TextField(blank=True, null=True, verbose_name='Alterações nas unhas pé direito')),
                        ('deformities_left', models.TextField(blank=True, null=True, verbose_name='Deformidades pé esquerdo')),
                        ('deformities_right', models.TextField(blank=True, null=True, verbose_name='Deformidades pé direito')),
                        ('sensitivity_test', models.TextField(blank=True, null=True, verbose_name='Teste de sensibilidade')),
                        ('other_procedures', models.TextField(blank=True, null=True, verbose_name='Outros procedimentos')),
                        ('photo', models.ImageField(blank=True, null=True, upload_to='client_photos/', verbose_name='Foto')),
                        ('professional', models.ForeignKey(
                            on_delete=django.db.models.deletion.CASCADE,
                            related_name='clients',
                            to='register.professional',
                            verbose_name='Profissional',
                        )),
                    ],
                    options={
                        'db_table': 'register_client',
                    },
                ),
            ],
            database_operations=[],  # tabela register_client já existe
        ),
    ]
