# backend\apps\register\serializers_clients.py
from rest_framework import serializers
from .models import Client

class ClientSerializer(serializers.ModelSerializer):
    takes_medication = serializers.CharField(required=False, allow_blank=True, max_length=255)
    had_surgery = serializers.CharField(required=False, allow_blank=True, max_length=255)
    is_pregnant = serializers.BooleanField(required=False)
    professional = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Client
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']
        extra_kwargs = {
            "email": {"required": False, "allow_null": True, "allow_blank": True},
            "phone": {"required": False, "allow_null": True, "allow_blank": True},
            "profession": {"required": False, "allow_null": True, "allow_blank": True},
            "city": {"required": False, "allow_null": True, "allow_blank": True},
            "state": {"required": False, "allow_null": True, "allow_blank": True},
            "postal_code": {"required": False, "allow_null": True, "allow_blank": True},
            "address": {"required": False, "allow_null": True, "allow_blank": True},
            "address_number": {"required": False, "allow_null": True, "allow_blank": True},
            "medication_details": {"required": False, "allow_null": True, "allow_blank": True},
            "surgery_details": {"required": False, "allow_null": True, "allow_blank": True},
            "pregnancy_details": {"required": False, "allow_null": True, "allow_blank": True},
            "pain_sensitivity": {"required": False, "allow_null": True, "allow_blank": True},
            "footwear_used": {"required": False, "allow_null": True, "allow_blank": True},
            "footwear_other": {"required": False, "allow_null": True, "allow_blank": True},
            "sock_used": {"required": False, "allow_null": True, "allow_blank": True},
            "clinical_history": {"required": False, "allow_null": True, "allow_blank": True},
            "clinical_history_other": {"required": False, "allow_null": True, "allow_blank": True},
            "professional_procedures": {"required": False, "allow_null": True, "allow_blank": True},
            # Continua com o restante dos campos clínicos…
        }

    # Normalizações e validações leves
    def validate_first_name(self, value):
        v = (value or '').strip()
        if not v:
            raise serializers.ValidationError("Nome é obrigatório")
        return v

    def validate_last_name(self, value):
        v = (value or '').strip()
        if not v:
            raise serializers.ValidationError("Sobrenome é obrigatório")
        return v

    def validate_email(self, value):
        if value is None:
            return None
        v = value.strip()
        return v.lower() if v else None

    def validate_phone(self, value):
        if value is None:
            return None
        v = value.strip()
        return v or None

    # cpf removido; profissão agora é um texto opcional


class ClientBasicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = [
            'id', 'first_name', 'last_name', 'phone', 'email',
            'address', 'address_number', 'city', 'state'
        ]
