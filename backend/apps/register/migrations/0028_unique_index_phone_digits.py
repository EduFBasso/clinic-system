from django.db import migrations

# Enforce uniqueness on phone after normalizing to digits only (e.g., '(11) 99999-9999' == '11999999999').
# This uses a unique expression index on regexp_replace(phone, '[^0-9]', '', 'g').
# Note: If there are existing duplicates that normalize to the same digits, this will fail until they are resolved.

SQL_CREATE_UNIQUE_IDX = r'''
CREATE UNIQUE INDEX IF NOT EXISTS register_client_phone_digits_uniq
ON public.register_client ((regexp_replace(phone, '[^0-9]', '', 'g')))
WHERE phone IS NOT NULL;
'''

SQL_DROP_UNIQUE_IDX = r'''
DROP INDEX IF EXISTS register_client_phone_digits_uniq;
'''


class Migration(migrations.Migration):
    dependencies = [
        ('register', '0027_cleanup_unique_phone_constraint'),
    ]

    # Index creation shouldn't be in a transaction for safety/perf; Django will handle accordingly
    atomic = False

    operations = [
        migrations.RunSQL(
            sql=SQL_CREATE_UNIQUE_IDX,
            reverse_sql=SQL_DROP_UNIQUE_IDX,
        ),
    ]
