from django.db import migrations

class Migration(migrations.Migration):
    dependencies = [
        ('register', '0019_replace_cpf_with_profession'),
    ]

    operations = [
        migrations.RenameField(
            model_name='client',
            old_name='address_street',
            new_name='address',
        ),
    ]
