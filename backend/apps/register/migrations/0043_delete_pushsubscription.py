from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("register", "0042_professionalsettings_defaults"),
    ]

    operations = [
        migrations.DeleteModel(
            name="PushSubscription",
        ),
    ]