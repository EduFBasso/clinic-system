from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone

from .models import Appointment
from .serializers import AppointmentSerializer


class IsProfessionalOrReadOnly(permissions.BasePermission):
    """Permissão simples: usuário autenticado pode ler; alterações restritas ao próprio profissional.
    Assumimos que request.user é Professional.
    """

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj: Appointment):
        if request.method in permissions.SAFE_METHODS:
            return True
        return getattr(request.user, "id", None) == getattr(obj.professional, "id", None)


class AppointmentViewSet(viewsets.ModelViewSet):
    serializer_class = AppointmentSerializer
    permission_classes = [IsProfessionalOrReadOnly]

    def get_queryset(self):
        qs = Appointment.objects.all()
        user = getattr(self.request, "user", None)
        # restringe a agenda ao profissional logado
        if user and getattr(user, "id", None):
            qs = qs.filter(professional_id=user.id)
        # filtros opcionais ?start=2025-09-01T00:00:00&end=2025-09-02T00:00:00&client=<id>
        start = self.request.query_params.get("start")
        end = self.request.query_params.get("end")
        client_id = self.request.query_params.get("client")
        status_val = self.request.query_params.get("status")

        if start:
            try:
                qs = qs.filter(end_at__gt=start)
            except Exception:
                pass
        if end:
            try:
                qs = qs.filter(start_at__lt=end)
            except Exception:
                pass
        if client_id:
            qs = qs.filter(client_id=client_id)
        if status_val:
            qs = qs.filter(status=status_val)
        return qs.select_related("professional", "client")

    @action(detail=False, methods=["get"], url_path="next")
    def next_for_client(self, request):
        """Retorna o próximo agendamento futuro opcionalmente filtrando por client=<id>."""
        now = timezone.now()
        qs = self.get_queryset().filter(start_at__gte=now).order_by("start_at")
        obj = qs.first()
        if not obj:
            return Response({"detail": "no-upcoming"})
        return Response(self.get_serializer(obj).data)
