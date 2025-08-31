# backend\apps\register\views_professionals.py
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.viewsets import ModelViewSet
from .models import Professional
from .serializers import ProfessionalSerializer, ProfessionalBasicSerializer


class ProfessionalViewSet(ModelViewSet):
    queryset = Professional.objects.all()
    serializer_class = ProfessionalSerializer
    permission_classes = [IsAuthenticated]


class ProfessionalBasicViewSet(ModelViewSet):
    serializer_class = ProfessionalBasicSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        # Oculta superusuários da lista pública de profissionais (não exibir no menu de login)
        return Professional.objects.filter(is_superuser=False, is_active=True)
