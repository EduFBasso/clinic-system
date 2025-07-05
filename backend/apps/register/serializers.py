# backend/apps/register/serializers.py

from .serializers_clients import ClientSerializer, ClientBasicSerializer
from .serializers_professionals import (
    ProfessionalSerializer,
    ProfessionalBasicSerializer
)
from .serializers_auth import CustomTokenObtainPairSerializer

"""
📘 Módulo: serializers.py

Arquivo integrador que importa os serializadores modulares:

- serializers_clients.py
- serializers_professionals.py
- serializers_auth.py

Serve como ponto único para importações por outros módulos.
"""

