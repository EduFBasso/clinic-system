# backend\apps\register\serializers_professionals.py

from rest_framework import serializers
from .models import Professional

class ProfessionalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Professional
        fields = '__all__'
        extra_kwargs = {
            'password': {'required': False, 'write_only': True}
        }


class ProfessionalBasicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Professional
        fields = ['id', 'first_name', 'last_name', 'register_number']

"""
📘 Módulo: serializers_professionals.py

Serializadores dedicados ao modelo Professional.

- ProfessionalSerializer: versão completa com suporte a senha.
- ProfessionalBasicSerializer: campos mínimos para dropdowns.

Utiliza extra_kwargs para ocultar e tornar opcional o campo 'password'.
"""