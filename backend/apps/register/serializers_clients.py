# backend\apps\register\serializers_clients.py

from rest_framework import serializers
from .models import Client

class ClientSerializer(serializers.ModelSerializer):
    takes_medication = serializers.BooleanField(required=False)
    had_surgery = serializers.BooleanField(required=False)
    is_pregnant = serializers.BooleanField(required=False)
    professional = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Client
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']


class ClientBasicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = [
            'id', 'first_name', 'last_name', 'phone',
            'address_street', 'address_number', 'city', 'state'
        ]

"""
📘 Módulo: serializers_clients.py

Serializadores específicos para o modelo Client.

- ClientSerializer: CRUD completo com campos booleanos opcionais.
- ClientBasicSerializer: versão leve para listagem de clientes.

Inclui restrição de leitura para professional e timestamps.
"""