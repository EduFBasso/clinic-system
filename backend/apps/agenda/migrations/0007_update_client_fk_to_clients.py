"""Update Appointment and FinalizeAudit FKs to point to clients.Client.

State-only change: the physical FK constraint already points to the same
table (register_client), so no database operations are needed.
"""
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('clients', '0001_initial'),
        ('register', '0038_remove_client_state'),
        ('agenda', '0006_rename_agenda_appo_finaliz_fts_agenda_appo_finaliz_86159e_idx_and_more'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AlterField(
                    model_name='appointment',
                    name='client',
                    field=models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='appointments',
                        to='clients.client',
                        verbose_name='Cliente',
                    ),
                ),
                migrations.AlterField(
                    model_name='finalizeaudit',
                    name='client',
                    field=models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='finalize_audits',
                        to='clients.client',
                    ),
                ),
            ],
            database_operations=[],  # FK física já aponta para register_client
        ),
    ]
