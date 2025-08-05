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
    queryset = Professional.objects.all()
    serializer_class = ProfessionalBasicSerializer
    permission_classes = [AllowAny]
