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


class Migration(migrations.Migration):
    dependencies = [
        ('register', '0025_alter_client_phone'),
    ]

    # Allow DDL outside a single transaction (not strictly required here, but safer)
    atomic = False

    operations = [
        migrations.RunSQL(SQL_ADD_UNIQUE, reverse_sql=SQL_DROP_UNIQUE),
    ]
