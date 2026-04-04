from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0001_initial"),
        ("agenda", "0007_update_client_fk_to_clients"),
    ]

    operations = [
        migrations.CreateModel(
            name="Encounter",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("started_at", models.DateTimeField(default=django.utils.timezone.now, verbose_name="Início do atendimento")),
                ("ended_at", models.DateTimeField(blank=True, null=True, verbose_name="Fim do atendimento")),
                ("chief_complaint", models.CharField(blank=True, max_length=255, verbose_name="Queixa principal")),
                ("assessment", models.TextField(blank=True, verbose_name="Avaliação")),
                ("plan", models.TextField(blank=True, verbose_name="Plano")),
                ("notes", models.TextField(blank=True, verbose_name="Notas")),
                ("status", models.CharField(choices=[("open", "Em andamento"), ("closed", "Encerrado"), ("canceled", "Cancelado")], default="open", max_length=12, verbose_name="Status")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("appointment", models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="clinical_encounter", to="agenda.appointment", verbose_name="Agendamento")),
                ("client", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="encounters", to="clients.client", verbose_name="Cliente")),
                ("professional", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="encounters", to="register.professional", verbose_name="Profissional")),
            ],
            options={"ordering": ["-started_at", "-id"]},
        ),
        migrations.CreateModel(
            name="Charge",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("charge_type", models.CharField(choices=[("quote", "Orçamento"), ("charge", "Cobrança")], default="charge", max_length=12, verbose_name="Tipo")),
                ("status", models.CharField(choices=[("draft", "Rascunho"), ("sent", "Enviado"), ("paid", "Pago"), ("canceled", "Cancelado")], default="draft", max_length=12, verbose_name="Status")),
                ("title", models.CharField(blank=True, max_length=120, verbose_name="Título")),
                ("notes", models.TextField(blank=True, verbose_name="Notas")),
                ("recipient_name", models.CharField(blank=True, max_length=160, verbose_name="Nome do destinatário")),
                ("recipient_phone", models.CharField(blank=True, max_length=32, verbose_name="Telefone do destinatário")),
                ("currency", models.CharField(default="BRL", max_length=8, verbose_name="Moeda")),
                ("total_amount", models.DecimalField(decimal_places=2, default=0, max_digits=10, verbose_name="Total")),
                ("shared_at", models.DateTimeField(blank=True, null=True, verbose_name="Compartilhado em")),
                ("paid_at", models.DateTimeField(blank=True, null=True, verbose_name="Pago em")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("appointment", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="charges", to="agenda.appointment", verbose_name="Agendamento")),
                ("client", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="charges", to="clients.client", verbose_name="Cliente")),
                ("encounter", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="charges", to="agenda.encounter", verbose_name="Atendimento")),
                ("professional", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="charges", to="register.professional", verbose_name="Profissional")),
            ],
            options={"ordering": ["-created_at", "-id"]},
        ),
        migrations.CreateModel(
            name="ClinicalRecord",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("record_type", models.CharField(choices=[("evolution", "Evolução"), ("assessment", "Avaliação"), ("plan", "Plano"), ("prescription", "Prescrição"), ("note", "Nota")], default="evolution", max_length=24, verbose_name="Tipo de registro")),
                ("title", models.CharField(blank=True, max_length=120, verbose_name="Título")),
                ("content", models.TextField(verbose_name="Conteúdo")),
                ("recorded_at", models.DateTimeField(default=django.utils.timezone.now, verbose_name="Registrado em")),
                ("is_confidential", models.BooleanField(default=False, verbose_name="Confidencial")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("client", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="clinical_records", to="clients.client", verbose_name="Cliente")),
                ("encounter", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="records", to="agenda.encounter", verbose_name="Atendimento")),
                ("professional", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="clinical_records", to="register.professional", verbose_name="Profissional")),
            ],
            options={"ordering": ["-recorded_at", "-id"]},
        ),
        migrations.CreateModel(
            name="ChargeItem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("item_type", models.CharField(choices=[("service", "Serviço"), ("product", "Produto"), ("custom", "Personalizado")], default="custom", max_length=12, verbose_name="Tipo de item")),
                ("description", models.CharField(blank=True, max_length=255, verbose_name="Descrição")),
                ("quantity", models.DecimalField(decimal_places=2, default=1, max_digits=10, verbose_name="Quantidade")),
                ("unit_price", models.DecimalField(decimal_places=2, default=0, max_digits=10, verbose_name="Preço unitário")),
                ("sort_order", models.PositiveIntegerField(default=0, verbose_name="Ordem")),
                ("notes", models.CharField(blank=True, max_length=255, verbose_name="Notas")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("charge", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="items", to="agenda.charge", verbose_name="Cobrança")),
                ("product", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="charge_items", to="inventory.product", verbose_name="Produto")),
                ("service", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="charge_items", to="inventory.service", verbose_name="Serviço")),
            ],
            options={"ordering": ["sort_order", "id"]},
        ),
        migrations.AddIndex(model_name="encounter", index=models.Index(fields=["professional", "client", "status"], name="agenda_encou_profess_5074bf_idx")),
        migrations.AddIndex(model_name="encounter", index=models.Index(fields=["professional", "started_at"], name="agenda_encou_profess_114294_idx")),
        migrations.AddIndex(model_name="encounter", index=models.Index(fields=["client", "started_at"], name="agenda_encou_client__07ddf0_idx")),
        migrations.AddIndex(model_name="charge", index=models.Index(fields=["professional", "client", "status"], name="agenda_charg_profess_a9145c_idx")),
        migrations.AddIndex(model_name="charge", index=models.Index(fields=["appointment", "status"], name="agenda_charg_appoint_0ce768_idx")),
        migrations.AddIndex(model_name="charge", index=models.Index(fields=["encounter", "status"], name="agenda_charg_encount_2bd985_idx")),
        migrations.AddIndex(model_name="charge", index=models.Index(fields=["created_at"], name="agenda_charg_created_30313b_idx")),
        migrations.AddIndex(model_name="clinicalrecord", index=models.Index(fields=["professional", "client", "recorded_at"], name="agenda_clini_profess_98f937_idx")),
        migrations.AddIndex(model_name="clinicalrecord", index=models.Index(fields=["client", "record_type", "recorded_at"], name="agenda_clini_client__1c85c0_idx")),
        migrations.AddIndex(model_name="clinicalrecord", index=models.Index(fields=["encounter", "recorded_at"], name="agenda_clini_encount_2680f7_idx")),
        migrations.AddIndex(model_name="chargeitem", index=models.Index(fields=["charge", "sort_order"], name="agenda_charg_charge__22e18d_idx")),
        migrations.AddIndex(model_name="chargeitem", index=models.Index(fields=["item_type"], name="agenda_charg_item_ty_4fa031_idx")),
    ]