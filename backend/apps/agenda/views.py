from rest_framework import viewsets, permissions, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone

from .models import Appointment, Charge, ClinicalRecord, Encounter, FinalizeAudit
from .serializers import (
    AppointmentSerializer,
    ChargeSerializer,
    ClinicalRecordSerializer,
    EncounterSerializer,
    FinalizeAuditSerializer,
    IntegrationConsultationSerializer,
)


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


class ProfessionalOwnedViewSet(viewsets.ModelViewSet):
    permission_classes = [IsProfessionalOrReadOnly]

    def get_queryset(self):
        qs = self.queryset
        user = getattr(self.request, "user", None)
        if user and getattr(user, "id", None):
            qs = qs.filter(professional_id=user.id)
        return qs

    def perform_create(self, serializer):
        serializer.save(professional=self.request.user)


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
        obj = serializer.save(professional=user)
        # Marcar device de criação (não obrigatório)
        try:
            dev_id = self.request.headers.get("x-device-id") or self.request.headers.get("X-Device-Id") or None
            dev_info = self.request.headers.get("x-device-info") or self.request.headers.get("X-Device-Info") or ""
            if dev_id:
                obj.created_device_id = dev_id[:64]
            if dev_info:
                # X-Device-Info pode vir como URL-encoded
                try:
                    from urllib.parse import unquote

                    dev_info = unquote(dev_info)
                except Exception:
                    pass
                obj.created_device_info = dev_info[:4000]
            obj.save(update_fields=["created_device_id", "created_device_info", "updated_at"])
        except Exception:
            pass

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
        from django.utils import timezone as _tz
        if not getattr(obj, "canceled_at", None):
            obj.canceled_at = _tz.now()
            update_fields = ["status", "canceled_at", "updated_at"]
        else:
            update_fields = ["status", "updated_at"]
        obj.save(update_fields=update_fields)
        return Response(self.get_serializer(obj).data, status=200)

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
        # Capturar headers do dispositivo e horário do cliente
        dev_id = request.headers.get("x-device-id") or request.headers.get("X-Device-Id") or None
        dev_info = request.headers.get("x-device-info") or request.headers.get("X-Device-Info") or ""
        client_now_iso = request.headers.get("x-client-now") or request.headers.get("X-Client-Now") or None
        client_now_dt = None
        if client_now_iso:
            try:
                from django.utils.dateparse import parse_datetime

                client_now_dt = parse_datetime(client_now_iso)
            except Exception:
                client_now_dt = None
        if obj.start_at and now < obj.start_at:
            # 422 sinaliza regra de negócio
            return Response({"detail": "compromisso ainda não iniciou", "code": "too_early"}, status=422)

        # Marca como concluído; encurta end_at apenas se em andamento
        obj.status = obj.Status.DONE
        adjusted = False
        if obj.end_at and now < obj.end_at:
            obj.end_at = now
            adjusted = True
            if obj.start_at and obj.end_at <= obj.start_at:
                obj.end_at = obj.start_at
        # Definir finalized_at uma única vez (idempotente)
        if not getattr(obj, "finalized_at", None):
            obj.finalized_at = now
        # Gravar device que finalizou (opcional)
        try:
            if dev_id:
                obj.ended_device_id = (dev_id or "")[:64]
            if dev_info:
                try:
                    from urllib.parse import unquote

                    dev_info = unquote(dev_info)
                except Exception:
                    pass
                obj.ended_device_info = (dev_info or "")[:4000]
            obj.save(update_fields=[
                "status",
                "end_at",
                "finalized_at",
                "ended_device_id",
                "ended_device_info",
                "updated_at",
            ])
        except Exception:
            obj.save(update_fields=["status", "end_at", "finalized_at", "updated_at"])

        # Registrar auditoria
        try:
            drift_ms = None
            if client_now_dt is not None:
                # usar timezone-aware e converter se necessário
                if timezone.is_naive(client_now_dt):
                    client_now_dt = timezone.make_aware(client_now_dt, timezone=timezone.utc)
                drift_ms = int((now - client_now_dt).total_seconds() * 1000)
            FinalizeAudit.objects.create(
                appointment=obj,
                professional=obj.professional,
                client=obj.client,
                device_id=dev_id[:64] if dev_id else None,
                device_info=(dev_info or "")[:4000],
                client_now=client_now_dt,
                server_now=now,
                drift_ms=drift_ms,
                adjusted_times=adjusted,
                reason="in_window" if adjusted else "finished",
            )
        except Exception:
            pass

        return Response(self.get_serializer(obj).data, status=200)

    @action(detail=True, methods=["post"], url_path="done")
    def done(self, request, pk=None):
        """Alias para finalize, por compatibilidade no frontend."""
        return self.finalize(request, pk)


class IsStaffOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_staff)


class FinalizeAuditListView(generics.ListAPIView):
    """Admin-only list endpoint to inspect finalize audits with optional filters.

    Query params:
    - appointment: int
    - device_id: str (exact)
    - start: ISO datetime (created_at >=)
    - end: ISO datetime (created_at <=)
    """

    serializer_class = FinalizeAuditSerializer
    permission_classes = [IsStaffOnly]

    def get_queryset(self):
        qs = FinalizeAudit.objects.select_related("appointment", "professional", "client").all()
        appt_id = self.request.query_params.get("appointment")
        device_id = self.request.query_params.get("device_id")
        start = self.request.query_params.get("start")
        end = self.request.query_params.get("end")
        if appt_id:
            try:
                qs = qs.filter(appointment_id=int(appt_id))
            except Exception:
                pass
        if device_id:
            qs = qs.filter(device_id=device_id)
        if start:
            try:
                qs = qs.filter(created_at__gte=start)
            except Exception:
                pass
        if end:
            try:
                qs = qs.filter(created_at__lte=end)
            except Exception:
                pass
        return qs.order_by("-created_at")


class IntegrationConsultationsListView(generics.ListAPIView):
    """Endpoint de leitura para integrações externas (ex.: Odoo).

    Retorna compromissos finalizados (status=done) no formato de "consultations".
    Requer autenticação padrão do sistema (JWT/Session). No futuro, podemos adicionar
    um token específico de integração.

    Filtros suportados:
    - start: ISO datetime (start_at >=)
    - end: ISO datetime (end_at <=)
    - updated_since: ISO datetime (updated_at >=) para pulls incrementais
    - client: id
    - professional: id (admin/staff pode ver outros; profissional comum vê apenas os seus)
    """

    serializer_class = IntegrationConsultationSerializer
    permission_classes = [IsProfessionalOrReadOnly]

    def get_queryset(self):
        qs = Appointment.objects.select_related("professional", "client").filter(status=Appointment.Status.DONE)
        user = getattr(self.request, "user", None)

        # Profissional comum: restringe aos seus próprios compromissos
        if user and getattr(user, "id", None) and not getattr(user, "is_staff", False):
            qs = qs.filter(professional_id=user.id)

        start = self.request.query_params.get("start")
        end = self.request.query_params.get("end")
        updated_since = self.request.query_params.get("updated_since")
        client_id = self.request.query_params.get("client")
        professional_id = self.request.query_params.get("professional")

        if start:
            try:
                qs = qs.filter(start_at__gte=start)
            except Exception:
                pass
        if end:
            try:
                qs = qs.filter(end_at__lte=end)
            except Exception:
                pass
        if updated_since:
            try:
                qs = qs.filter(updated_at__gte=updated_since)
            except Exception:
                pass
        if client_id:
            qs = qs.filter(client_id=client_id)
        if professional_id:
            qs = qs.filter(professional_id=professional_id)

        # Ordenação padrão: updated_at crescente para facilitar pulls incrementais determinísticos
        return qs.order_by("updated_at", "id")


class EncounterViewSet(ProfessionalOwnedViewSet):
    serializer_class = EncounterSerializer
    queryset = Encounter.objects.select_related("professional", "client", "appointment")

    def get_queryset(self):
        qs = super().get_queryset()
        client_id = self.request.query_params.get("client")
        appointment_id = self.request.query_params.get("appointment")
        status_val = self.request.query_params.get("status")
        if client_id:
            qs = qs.filter(client_id=client_id)
        if appointment_id:
            qs = qs.filter(appointment_id=appointment_id)
        if status_val:
            qs = qs.filter(status=status_val)
        return qs

    def destroy(self, request, *args, **kwargs):
        return Response({"detail": "Exclusão não permitida. Cancele ou encerre o atendimento."}, status=405)

    @action(detail=True, methods=["post"], url_path="close")
    def close(self, request, pk=None):
        encounter = self.get_object()
        if encounter.status == Encounter.Status.CLOSED:
            return Response(self.get_serializer(encounter).data, status=200)
        if encounter.status == Encounter.Status.CANCELED:
            return Response({"detail": "Atendimento cancelado não pode ser encerrado."}, status=400)
        encounter.status = Encounter.Status.CLOSED
        if encounter.ended_at is None:
            encounter.ended_at = timezone.now()
        encounter.save()
        return Response(self.get_serializer(encounter).data, status=200)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        encounter = self.get_object()
        if encounter.status == Encounter.Status.CANCELED:
            return Response(self.get_serializer(encounter).data, status=200)
        encounter.status = Encounter.Status.CANCELED
        if encounter.ended_at is None:
            encounter.ended_at = timezone.now()
        encounter.save()
        return Response(self.get_serializer(encounter).data, status=200)


class ClinicalRecordViewSet(ProfessionalOwnedViewSet):
    serializer_class = ClinicalRecordSerializer
    queryset = ClinicalRecord.objects.select_related("professional", "client", "encounter")

    def get_queryset(self):
        qs = super().get_queryset()
        client_id = self.request.query_params.get("client")
        encounter_id = self.request.query_params.get("encounter")
        record_type = self.request.query_params.get("record_type")
        if client_id:
            qs = qs.filter(client_id=client_id)
        if encounter_id:
            qs = qs.filter(encounter_id=encounter_id)
        if record_type:
            qs = qs.filter(record_type=record_type)
        return qs

    def destroy(self, request, *args, **kwargs):
        return Response({"detail": "Exclusão não permitida. Preserve o histórico do prontuário."}, status=405)


class ChargeViewSet(ProfessionalOwnedViewSet):
    serializer_class = ChargeSerializer
    queryset = Charge.objects.select_related(
        "professional", "client", "encounter", "appointment"
    ).prefetch_related("items")

    def get_queryset(self):
        qs = super().get_queryset()
        client_id = self.request.query_params.get("client")
        encounter_id = self.request.query_params.get("encounter")
        appointment_id = self.request.query_params.get("appointment")
        status_val = self.request.query_params.get("status")
        charge_type = self.request.query_params.get("charge_type")
        if client_id:
            qs = qs.filter(client_id=client_id)
        if encounter_id:
            qs = qs.filter(encounter_id=encounter_id)
        if appointment_id:
            qs = qs.filter(appointment_id=appointment_id)
        if status_val:
            qs = qs.filter(status=status_val)
        if charge_type:
            qs = qs.filter(charge_type=charge_type)
        return qs

    def destroy(self, request, *args, **kwargs):
        return Response({"detail": "Exclusão não permitida. Cancele a cobrança."}, status=405)

    @action(detail=True, methods=["post"], url_path="mark-sent")
    def mark_sent(self, request, pk=None):
        charge = self.get_object()
        if charge.status == Charge.Status.CANCELED:
            return Response({"detail": "Cobrança cancelada não pode ser enviada."}, status=400)
        charge.status = Charge.Status.SENT
        if charge.shared_at is None:
            charge.shared_at = timezone.now()
        charge.save()
        return Response(self.get_serializer(charge).data, status=200)

    @action(detail=True, methods=["post"], url_path="mark-paid")
    def mark_paid(self, request, pk=None):
        charge = self.get_object()
        if charge.status == Charge.Status.CANCELED:
            return Response({"detail": "Cobrança cancelada não pode ser paga."}, status=400)
        charge.status = Charge.Status.PAID
        if charge.paid_at is None:
            charge.paid_at = timezone.now()
        charge.save()
        return Response(self.get_serializer(charge).data, status=200)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        charge = self.get_object()
        if charge.status == Charge.Status.PAID:
            return Response({"detail": "Cobrança paga não pode ser cancelada."}, status=400)
        charge.status = Charge.Status.CANCELED
        charge.save()
        return Response(self.get_serializer(charge).data, status=200)
