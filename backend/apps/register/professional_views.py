# backend\apps\register\views_professionals.py
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.viewsets import ModelViewSet
from .models import Professional, ProfessionalSettings
from .serializers import (
    ProfessionalSerializer,
    ProfessionalBasicSerializer,
    ProfessionalSettingsSerializer,
)
from rest_framework.decorators import action
from rest_framework.response import Response


class ProfessionalViewSet(ModelViewSet):
    queryset = Professional.objects.all()
    serializer_class = ProfessionalSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=["get", "patch"], url_path="settings")
    def professional_settings(self, request):
        user = request.user
        if not user or not user.is_authenticated:
            return Response({"detail": "Authentication required."}, status=401)
        obj, _ = ProfessionalSettings.objects.get_or_create(professional_id=user.id)
        if request.method.lower() == "patch":
            serializer = ProfessionalSettingsSerializer(obj, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            try:
                serializer.save()
            except Exception as e:
                # Converte qualquer erro inesperado em 400 para evitar 500 no cliente
                return Response({"detail": str(e)}, status=400)
            return Response(serializer.data)
        return Response(ProfessionalSettingsSerializer(obj).data)


class ProfessionalBasicViewSet(ModelViewSet):
    serializer_class = ProfessionalBasicSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        # Oculta superusuários da lista pública de profissionais (não exibir no menu de login)
        return Professional.objects.filter(is_superuser=False, is_active=True)
