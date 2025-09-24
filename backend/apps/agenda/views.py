from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.conf import settings
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

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        # garante request no contexto para validação que depende do usuário
        ctx["request"] = getattr(self, "request", None)
        return ctx

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

    def perform_create(self, serializer):
        # profissional sempre é o usuário autenticado
        user = getattr(self.request, "user", None)
        serializer.save(professional=user)

    # Impede exclusão: histórico deve ser preservado. Fornecemos ação de cancelamento.
    def destroy(self, request, *args, **kwargs):
        return Response({"detail": "Exclusão não permitida. Cancele o agendamento."}, status=405)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        obj = self.get_object()
        # Apenas profissional dono pode cancelar (permission_classes já cobre update, mas reforçamos)
        if getattr(request.user, "id", None) != getattr(obj.professional, "id", None):
            return Response({"detail": "forbidden"}, status=403)
        if obj.status == Appointment.Status.CANCELED:
            return Response({"detail": "já cancelado"}, status=200)
        obj.status = Appointment.Status.CANCELED
        obj.save(update_fields=["status", "updated_at"])
        return Response(self.get_serializer(obj).data, status=200)

    @action(detail=False, methods=["post"], url_path="purge")
    def purge(self, request):
        """Apaga compromissos do profissional autenticado (DEV-only).

        Aceita JSON opcional {start: ISO, end: ISO} para limitar por intervalo.
        Somente disponível com settings.DEBUG=True para evitar uso em produção.
        """
        if not settings.DEBUG:
            return Response({"detail": "forbidden"}, status=403)
        user = getattr(request, "user", None)
        if not (user and getattr(user, "id", None)):
            return Response({"detail": "unauthorized"}, status=401)

        qs = Appointment.objects.filter(professional_id=user.id)
        start = request.data.get("start")
        end = request.data.get("end")
        try:
            if start:
                qs = qs.filter(start_at__gte=start)
            if end:
                qs = qs.filter(end_at__lte=end)
        except Exception:
            # Se datas inválidas forem passadas, ignore filtros e apague tudo do profissional
            pass

        deleted, _ = qs.delete()
        return Response({"deleted": deleted})

    @action(detail=False, methods=["get"], url_path="next")
    def next_for_client(self, request):
        """Retorna o próximo agendamento futuro opcionalmente filtrando por client=<id>."""
        now = timezone.now()
        qs = self.get_queryset().filter(start_at__gte=now).order_by("start_at")
        obj = qs.first()
        if not obj:
            return Response({"detail": "no-upcoming"})
        return Response(self.get_serializer(obj).data)

    @action(detail=True, methods=["post"], url_path="finalize")
    def finalize(self, request, pk=None):
        """Conclui o compromisso como 'done' sem permitir edição geral.

        Regras:
        - Apenas o profissional dono pode concluir.
        - Só é permitido se o status atual for 'scheduled'.
        - Permite finalização antecipada durante a janela em andamento (start_at <= now < end_at).
          Não permite antes do início.
        - Ajusta o fim (end_at) SOMENTE se ainda em andamento (now < end_at) para refletir duração real.
          Se o compromisso já terminou (now >= end_at) mantemos o fim planejado.
        """
        obj = self.get_object()
        # Permissão explícita
        if getattr(request.user, "id", None) != getattr(obj.professional, "id", None):
            return Response({"detail": "forbidden"}, status=403)
        if obj.status == obj.Status.DONE:
            # idempotente
            return Response(self.get_serializer(obj).data, status=200)
        if obj.status == obj.Status.CANCELED:
            return Response({"detail": "compromisso cancelado não pode ser concluído"}, status=400)

        now = timezone.now()
        if obj.start_at and now < obj.start_at:
            # 422 sinaliza regra de negócio
            return Response({"detail": "compromisso ainda não iniciou", "code": "too_early"}, status=422)

        # Marca como concluído; encurta end_at apenas se em andamento
        obj.status = obj.Status.DONE
        if obj.end_at and now < obj.end_at:
            obj.end_at = now
            if obj.start_at and obj.end_at <= obj.start_at:
                obj.end_at = obj.start_at
        obj.save(update_fields=["status", "end_at", "updated_at"])
        return Response(self.get_serializer(obj).data, status=200)

    @action(detail=True, methods=["post"], url_path="done")
    def done(self, request, pk=None):
        """Alias para finalize, por compatibilidade no frontend."""
        return self.finalize(request, pk)
