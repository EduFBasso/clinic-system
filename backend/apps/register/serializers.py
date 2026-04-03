from .serializers_clients import ClientSerializer, ClientBasicSerializer
from .serializers_professionals import (
    ProfessionalSerializer,
    ProfessionalBasicSerializer
)
from .serializers_auth import CustomTokenObtainPairSerializer
from rest_framework import serializers
from .models import ProfessionalSettings
from typing import Any, Dict


class ProfessionalSettingsSerializer(serializers.ModelSerializer):
    def validate_work_start_hour(self, value: int) -> int:
        if not (0 <= value <= 23):
            raise serializers.ValidationError("work_start_hour deve estar entre 0 e 23")
        return value

    def validate_work_end_hour(self, value: int) -> int:
        if not (1 <= value <= 24):
            raise serializers.ValidationError("work_end_hour deve estar entre 1 e 24")
        return value

    def validate_slot_minutes(self, value: int) -> int:
        if value not in (5, 10, 15, 20, 30, 45, 60, 90, 120):
            raise serializers.ValidationError(
                "slot_minutes inválido. Use um dos valores: 5, 10, 15, 20, 30, 45, 60, 90, 120"
            )
        return value

    def validate(self, attrs: Dict[str, Any]) -> Dict[str, Any]:
        instance = getattr(self, 'instance', None)
        start = attrs.get('work_start_hour', getattr(instance, 'work_start_hour', 8))
        end = attrs.get('work_end_hour', getattr(instance, 'work_end_hour', 18))
        if start >= end:
            raise serializers.ValidationError({
                'non_field_errors': [
                    'Intervalo inválido: work_start_hour deve ser menor que work_end_hour'
                ]
            })
        return attrs
    class Meta:
        model = ProfessionalSettings
        fields = [
            "work_start_hour",
            "work_end_hour",
            "slot_minutes",
            "confirm_message_enabled",
            "confirm_message_template",
            "pix_key_type",
            "pix_key_value",
        ]
