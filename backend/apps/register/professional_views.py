# backend\apps\register\views_professionals.py
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet
from .models import Professional, ProfessionalSettings, PushSubscription
from .serializers import (
    ProfessionalSerializer,
    ProfessionalBasicSerializer,
    ProfessionalSettingsSerializer,
    PushSubscriptionSerializer,
)
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status


class ProfessionalViewSet(ModelViewSet):
    queryset = Professional.objects.all()
    serializer_class = ProfessionalSerializer
    permission_classes = [IsAuthenticated]

    def perform_destroy(self, instance: Professional):
        # Soft delete: mark as inactive/deactivated instead of removing rows
        instance.deactivate("desativado via API")

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response({"detail": "Profissional desativado."}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="reativar")
    def reactivate(self, request, pk=None):
        prof = self.get_object()
        prof.reactivate()
        return Response({"detail": "Profissional reativado."})

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

    @action(detail=False, methods=["get", "patch"], url_path="me")
    def me(self, request):
        """Permite ao profissional autenticado visualizar/atualizar seu próprio perfil.
        GET: retorna first_name, last_name, register_number, id, email
        PATCH: atualiza campos permitidos (first_name, last_name, register_number)
        """
        user = request.user
        if not user or not user.is_authenticated:
            return Response({"detail": "Authentication required."}, status=401)
        if request.method.lower() == "get":
            return Response(ProfessionalBasicSerializer(user).data)
        allowed_fields = {"first_name", "last_name", "register_number"}
        payload = {k: v for k, v in request.data.items() if k in allowed_fields}
        if not payload:
            return Response({"detail": "No allowed fields to update."}, status=400)
        for k, v in payload.items():
            setattr(user, k, v)
        user.save(update_fields=list(payload.keys()))
        return Response(ProfessionalBasicSerializer(user).data)

    @action(detail=False, methods=["post", "delete"], url_path="push-subscription")
    def push_subscription(self, request):
        """POST: cria ou atualiza uma assinatura push por endpoint.
        DELETE: remove a assinatura pelo endpoint informado no body.
        """
        user = request.user
        if not user or not user.is_authenticated:
            return Response({"detail": "Authentication required."}, status=401)

        if request.method.upper() == "DELETE":
            endpoint = request.data.get("endpoint", "")
            if not endpoint:
                return Response({"detail": "endpoint obrigatório."}, status=400)
            deleted, _ = PushSubscription.objects.filter(
                professional_id=user.id, endpoint=endpoint
            ).delete()
            if deleted:
                return Response(status=status.HTTP_204_NO_CONTENT)
            return Response({"detail": "Assinatura não encontrada."}, status=404)

        # POST — upsert by endpoint
        serializer = PushSubscriptionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        endpoint = serializer.validated_data["endpoint"]
        user_agent = request.META.get("HTTP_USER_AGENT", "")[:256]
        PushSubscription.objects.update_or_create(
            professional_id=user.id,
            endpoint=endpoint,
            defaults={
                "p256dh": serializer.validated_data["p256dh"],
                "auth": serializer.validated_data["auth"],
                "user_agent": user_agent,
            },
        )
        return Response(status=status.HTTP_201_CREATED)


class ProfessionalBasicViewSet(ReadOnlyModelViewSet):
    serializer_class = ProfessionalBasicSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        # Oculta superusuários da lista pública de profissionais (não exibir no menu de login)
        return Professional.objects.filter(is_superuser=False, is_active=True)
