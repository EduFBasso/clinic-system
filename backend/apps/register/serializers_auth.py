# backend\apps\register\serializers_auth.py

from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        return token

    def validate(self, attrs):
        data = super().validate(attrs)

        data['professional'] = {
            'id': self.user.id,
            'first_name': self.user.first_name,
            'last_name': self.user.last_name,
            'email': self.user.email,
            'register_number': self.user.register_number,
            'specialty': self.user.specialty
        }

        return data

"""
📘 Módulo: serializers_auth.py

Serializador personalizado para autenticação JWT.

- CustomTokenObtainPairSerializer: inclui dados extras no payload.
- Retorna informações úteis do profissional junto com o token.

Permite integração suave com frontend protegido por JWT.
"""