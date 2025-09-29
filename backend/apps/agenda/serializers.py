from rest_framework import serializers
from django.utils import timezone

from .models import Appointment, FinalizeAudit


class AppointmentSerializer(serializers.ModelSerializer):
    # Garante que 'professional' não seja exigido no POST e seja somente leitura
    professional = serializers.PrimaryKeyRelatedField(read_only=True)
    professional_name = serializers.SerializerMethodField(read_only=True)
    client_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Appointment
        fields = [
            "id",
            "professional",
            "client",
            "professional_name",
            "client_name",
            "title",
            "visit_type",
            "start_at",
            "end_at",
            "location",
            "notes",
            "status",
            "created_device_id",
            "created_device_info",
            "ended_device_id",
            "ended_device_info",
            "created_at",
            "updated_at",
        ]
    read_only_fields = [
        "created_at",
        "updated_at",
        "professional",
        "created_device_id",
        "created_device_info",
        "ended_device_id",
        "ended_device_info",
    ]

    def get_professional_name(self, obj):
        p = obj.professional
        if getattr(p, "id", None):
            return f"{p.first_name} {p.last_name}"
        return None

    def get_client_name(self, obj):
        c = obj.client
        if getattr(c, "id", None):
            return f"{c.first_name} {c.last_name}"
        return None

    def validate(self, attrs):
        start = attrs.get("start_at", getattr(self.instance, "start_at", None))
        end = attrs.get("end_at", getattr(self.instance, "end_at", None))
        if start and end and end <= start:
            raise serializers.ValidationError({"end_at": "Fim deve ser após o início."})

        now = timezone.now()

        # Criação: não permitir agendamento no passado
        if self.instance is None and start and start < now:
            raise serializers.ValidationError({"start_at": "Não é permitido agendar no passado."})

        # Edição: permitir alterações com regras pontuais
        if self.instance is not None:
            inst_status = getattr(self.instance, "status", None)
            # Apenas compromissos ativos (scheduled) podem ser editados
            if inst_status and inst_status != Appointment.Status.SCHEDULED:
                raise serializers.ValidationError({
                    "detail": "Somente compromissos ativos podem ser editados."
                })
            # Se o compromisso já está no passado, bloquear edições genéricas
            # Exceções permitidas:
            #  - status -> 'done' (finalização)
            #  - encurtar end_at (sem mover início)
            inst_start = getattr(self.instance, 'start_at', None)
            inst_end = getattr(self.instance, 'end_at', None)
            if inst_start and inst_start < now:
                allowed = False
                # permitir marcar como done
                if 'status' in attrs and attrs.get('status') == Appointment.Status.DONE:
                    allowed = True
                # permitir apenas encurtar o fim (novo end <= atual end) e não mover início
                if 'end_at' in attrs and 'start_at' not in attrs:
                    try:
                        new_end = attrs.get('end_at')
                        if new_end is not None and inst_end is not None and new_end <= inst_end:
                            allowed = True
                    except Exception:
                        pass
                if not allowed:
                    raise serializers.ValidationError({
                        'detail': 'Edição de compromissos iniciados no passado não é permitida.'
                    })
            # Não permitir mover o início para o passado APENAS quando o campo start_at for explicitamente alterado.
            # Edits que não alteram start_at (por exemplo, encurtar end_at ou marcar como done) devem ser permitidos
            # mesmo se o compromisso já tiver iniciado no passado.
            if "start_at" in attrs:
                try:
                    new_start = attrs.get("start_at")
                    if new_start is not None and new_start < now:
                        raise serializers.ValidationError({
                            "start_at": "Não é permitido reagendar para o passado."
                        })
                except Exception:
                    # Se o start_at for inválido, deixe validações padrão tratarem adiante
                    pass

        # Cliente não pode ser alterado após criação do agendamento
        if self.instance is not None and "client" in attrs:
            if attrs["client"].id != self.instance.client.id:
                raise serializers.ValidationError({"client": "Cliente não pode ser alterado após criação."})

        # Tenta obter o profissional do payload; se ausente, usa o usuário autenticado
        professional = attrs.get("professional", getattr(self.instance, "professional", None))
        if professional is None:
            req = self.context.get("request") if hasattr(self, "context") else None
            user = getattr(req, "user", None) if req else None
            if getattr(user, "id", None):
                professional = user
        client = attrs.get("client", getattr(self.instance, "client", None))

        # Regra de negócio: bloquear novo agendamento se o cliente possui compromisso pendente (status scheduled no passado)
        # "Pendente" aqui significa agendamento que já terminou (end_at < now) mas não foi concluído (done) nem cancelado.
        if self.instance is None and client is not None:
            pending_qs = (
                Appointment.objects.filter(client=client, status=Appointment.Status.SCHEDULED)
                .filter(end_at__lt=now)
            )
            if pending_qs.exists():
                raise serializers.ValidationError({
                    "client": "Cliente possui compromisso pendente (não concluído/cancelado). Resolva o anterior antes de agendar um novo."
                })
        if professional and start and end:
            # conflito simples
            inst = self.instance if getattr(self, "instance", None) else None
            from django.db.models import Q

            conflict = (
                Appointment.objects.filter(professional=professional)
                .exclude(status=Appointment.Status.CANCELED)
                .filter(Q(start_at__lt=end) & Q(end_at__gt=start))
            )
            if inst is not None:
                conflict = conflict.exclude(pk=inst.pk)
            if conflict.exists():
                raise serializers.ValidationError("Conflito de horário para o profissional.")

        return attrs


class FinalizeAuditSerializer(serializers.ModelSerializer):
    appointment_id = serializers.IntegerField(source="appointment.id", read_only=True)
    professional_id = serializers.IntegerField(source="professional.id", read_only=True)
    client_id = serializers.IntegerField(source="client.id", read_only=True)

    class Meta:
        model = FinalizeAudit
        fields = [
            "id",
            "appointment_id",
            "professional_id",
            "client_id",
            "device_id",
            "device_info",
            "client_now",
            "server_now",
            "drift_ms",
            "adjusted_times",
            "reason",
            "created_at",
        ]
        read_only_fields = fields
