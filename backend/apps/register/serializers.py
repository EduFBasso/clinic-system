# backend/apps/register/serializers.py
from .serializers_clients import ClientSerializer, ClientBasicSerializer
from .serializers_professionals import (
    ProfessionalSerializer,
    ProfessionalBasicSerializer
)
from .serializers_auth import CustomTokenObtainPairSerializer
