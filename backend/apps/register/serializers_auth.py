# backend\apps\register\serializers_auth.py
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework import serializers
from django.contrib.auth import authenticate
from django.utils.translation import gettext_lazy as _

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    # Garantimos que o campo de entrada é 'email' + 'password'
    username_field = 'email'

    def validate(self, attrs):
        email = attrs.get("email")
        password = attrs.get("password")

        user = authenticate(username=email, password=password)

        if user is None:
            raise serializers.ValidationError(_("Credenciais inválidas ou profissional não encontrado."))

        if not user.is_active:
            raise serializers.ValidationError(_("Essa conta está desativada."))

        data = super().validate(attrs)

        # Adiciona dados extras ao payload do frontend
        data['professional'] = {
            'id': user.id,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'email': user.email,
            'register_number': user.register_number,
            'specialty': user.specialty
        }

        return data
    
    
