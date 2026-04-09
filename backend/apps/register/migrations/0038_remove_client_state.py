"""Remove Client from register app state.

The physical table register_client is kept intact — only the state
ownership is transferred to the clients app.
"""
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('clients', '0001_initial'),
        ('register', '0037_delete_accesscode'),
        # Ensure all agenda DB migrations that reference register.Client
        # have already run before we remove it from state.
        ('agenda', '0006_rename_agenda_appo_finaliz_fts_agenda_appo_finaliz_86159e_idx_and_more'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.DeleteModel(name='Client'),
            ],
            database_operations=[],  # não toca na tabela
        ),
    ]
