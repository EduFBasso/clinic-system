from django.db import migrations


def seed_catalog_from_procedures(apps, schema_editor):
    Procedure = apps.get_model('odonto', 'Procedure')
    ProcedureNameSuggestion = apps.get_model('odonto', 'ProcedureNameSuggestion')
    ProductCatalogItem = apps.get_model('odonto', 'ProductCatalogItem')

    service_seen = {}
    product_latest = {}

    procedures = (
        Procedure.objects.select_related('arcade')
        .filter(name__isnull=False)
        .exclude(name='')
        .order_by('id')
    )

    for proc in procedures.iterator(chunk_size=2000):
        professional_id = proc.arcade.professional_id
        clean_name = (proc.name or '').strip()
        if not clean_name:
            continue

        lowered = clean_name.lower()
        key = (professional_id, lowered)

        if proc.is_product:
            product_latest[key] = {
                'professional_id': professional_id,
                'name': clean_name,
                'last_value': proc.patient_amount,
            }
            continue

        if key not in service_seen:
            service_seen[key] = {
                'professional_id': professional_id,
                'name': clean_name,
            }

    suggestions_to_create = [
        ProcedureNameSuggestion(
            professional_id=item['professional_id'],
            name=item['name'],
        )
        for item in service_seen.values()
    ]

    catalogs_to_create = [
        ProductCatalogItem(
            professional_id=item['professional_id'],
            name=item['name'],
            last_value=item['last_value'],
        )
        for item in product_latest.values()
    ]

    if suggestions_to_create:
        ProcedureNameSuggestion.objects.bulk_create(
            suggestions_to_create,
            batch_size=1000,
        )

    if catalogs_to_create:
        ProductCatalogItem.objects.bulk_create(
            catalogs_to_create,
            batch_size=1000,
        )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('odonto', '0005_catalog_models'),
    ]

    operations = [
        migrations.RunPython(seed_catalog_from_procedures, noop_reverse),
    ]
