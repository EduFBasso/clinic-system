from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('agenda', '0002_alter_appointment_visit_type'),
        ('register', '__first__'),
    ]

    operations = [
        migrations.AddField(
            model_name='appointment',
            name='created_device_id',
            field=models.CharField(blank=True, help_text='Identificador do dispositivo que criou o compromisso', max_length=64, null=True),
        ),
        migrations.AddField(
            model_name='appointment',
            name='created_device_info',
            field=models.TextField(blank=True, help_text='Informações técnicas do dispositivo (JSON) de criação'),
        ),
        migrations.AddField(
            model_name='appointment',
            name='ended_device_id',
            field=models.CharField(blank=True, help_text='Identificador do dispositivo que finalizou o compromisso', max_length=64, null=True),
        ),
        migrations.AddField(
            model_name='appointment',
            name='ended_device_info',
            field=models.TextField(blank=True, help_text='Informações técnicas do dispositivo (JSON) de finalização'),
        ),
        migrations.AddIndex(
            model_name='appointment',
            index=models.Index(fields=['created_device_id'], name='agenda_app_created__idx'),
        ),
        migrations.AddIndex(
            model_name='appointment',
            index=models.Index(fields=['ended_device_id'], name='agenda_app_ended_dev_idx'),
        ),
        migrations.CreateModel(
            name='FinalizeAudit',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('device_id', models.CharField(blank=True, max_length=64, null=True)),
                ('device_info', models.TextField(blank=True)),
                ('client_now', models.DateTimeField(blank=True, null=True)),
                ('server_now', models.DateTimeField()),
                ('drift_ms', models.IntegerField(blank=True, null=True)),
                ('adjusted_times', models.BooleanField(default=False)),
                ('reason', models.CharField(blank=True, max_length=32)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('appointment', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='finalize_audits', to='agenda.appointment')),
                ('client', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='finalize_audits', to='register.client')),
                ('professional', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='finalize_audits', to='register.professional')),
            ],
        ),
        migrations.AddIndex(
            model_name='finalizeaudit',
            index=models.Index(fields=['appointment', 'created_at'], name='agenda_fin_appointm_idx'),
        ),
        migrations.AddIndex(
            model_name='finalizeaudit',
            index=models.Index(fields=['professional', 'created_at'], name='agenda_fin_professi_idx'),
        ),
        migrations.AddIndex(
            model_name='finalizeaudit',
            index=models.Index(fields=['client', 'created_at'], name='agenda_fin_client_c_idx'),
        ),
        migrations.AddIndex(
            model_name='finalizeaudit',
            index=models.Index(fields=['device_id'], name='agenda_fin_device_i_idx'),
        ),
    ]
