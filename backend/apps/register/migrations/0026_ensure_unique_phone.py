from django.db import migrations


SQL_ADD_UNIQUE = r'''
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.register_client'::regclass
          AND conname = 'register_client_phone_key'
    ) THEN
        ALTER TABLE public.register_client
        ADD CONSTRAINT register_client_phone_key UNIQUE (phone);
    END IF;
END $$;
'''

SQL_DROP_UNIQUE = r'''
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.register_client'::regclass
          AND conname = 'register_client_phone_key'
    ) THEN
        ALTER TABLE public.register_client
        DROP CONSTRAINT register_client_phone_key;
    END IF;
END $$;
'''


def _run_add_unique(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    schema_editor.execute(SQL_ADD_UNIQUE)


def _run_drop_unique(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    schema_editor.execute(SQL_DROP_UNIQUE)


class Migration(migrations.Migration):
    dependencies = [
        ('register', '0025_alter_client_phone'),
    ]

    # Allow DDL outside a single transaction (not strictly required here, but safer)
    atomic = False

    operations = [
        migrations.RunPython(_run_add_unique, reverse_code=_run_drop_unique),
    ]
