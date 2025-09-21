from rest_framework import serializers
from django.utils import timezone

from .models import Appointment


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
            "created_at",
            "updated_at",
        ]
    read_only_fields = ["created_at", "updated_at", "professional"]

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

        if self.instance is not None:
            # Bloqueio geral temporário de edição: nenhuma alteração via PATCH/PUT é permitida
            # Diretriz: utilize a ação de cancelamento e crie novo agendamento.
            raise serializers.ValidationError({
                "detail": "Edição de compromissos está temporariamente bloqueada. Cancele e crie um novo agendamento."
            })
            # As regras abaixo permanecem como documentação e podem ser reativadas quando edição for liberada.
            # Atualização: bloquear qualquer edição de agendamento que já começou (passado ou em andamento)
            # Requisito de negócio: registros históricos são somente leitura (somente ação dedicada p/ cancelar)
            inst_start = getattr(self.instance, "start_at", None)
            inst_end = getattr(self.instance, "end_at", None)
            if inst_end and inst_end < now:
                raise serializers.ValidationError({"detail": "Agendamentos passados não podem ser editados."})
            # Se já iniciou (start_at <= now < end_at) também não permitir alterações para evitar inconsistências
            if inst_start and inst_start <= now and (inst_end is None or inst_end > now):
                raise serializers.ValidationError({"detail": "Agendamentos em andamento não podem ser editados."})

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
