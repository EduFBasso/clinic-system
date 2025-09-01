from rest_framework import serializers

from .models import Appointment


class AppointmentSerializer(serializers.ModelSerializer):
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
        read_only_fields = ["created_at", "updated_at"]

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

        professional = attrs.get("professional", getattr(self.instance, "professional", None))
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
