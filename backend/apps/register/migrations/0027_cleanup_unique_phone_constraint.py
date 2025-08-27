from django.db import migrations


SQL_CLEAN_DUPLICATE_UNIQUE = r'''
DO $$
DECLARE
    cnt int;
    has_extra boolean;
BEGIN
    -- Count unique constraints on column phone
    SELECT COUNT(*) INTO cnt
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
    WHERE n.nspname = 'public'
      AND t.relname = 'register_client'
      AND c.contype = 'u'
      AND a.attname = 'phone';

    -- Check if our extra constraint exists
    SELECT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.register_client'::regclass
          AND conname = 'register_client_phone_key'
    ) INTO has_extra;

    -- If there's more than one unique on phone and our extra exists, drop it
    IF cnt > 1 AND has_extra THEN
        ALTER TABLE public.register_client
        DROP CONSTRAINT register_client_phone_key;
    END IF;
END $$;
'''

SQL_RESTORE_IF_MISSING = r'''
DO $$
BEGIN
    -- Recreate a unique constraint on phone only if none exists
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
        WHERE n.nspname = 'public'
          AND t.relname = 'register_client'
          AND c.contype = 'u'
          AND a.attname = 'phone'
    ) THEN
        ALTER TABLE public.register_client
        ADD CONSTRAINT register_client_phone_key UNIQUE (phone);
    END IF;
END $$;
'''


class Migration(migrations.Migration):
    dependencies = [
        ('register', '0026_ensure_unique_phone'),
    ]

    atomic = False

    operations = [
        migrations.RunSQL(SQL_CLEAN_DUPLICATE_UNIQUE, reverse_sql=SQL_RESTORE_IF_MISSING),
    ]
