from rest_framework import filters
from rest_framework.exceptions import ValidationError
from django.db import IntegrityError
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ModelViewSet
from apps.clients.models import Client
from apps.clients.serializers import ClientSerializer, ClientBasicSerializer


class ClientViewSet(ModelViewSet):
    serializer_class = ClientSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['first_name', 'last_name', 'city', 'state']
    ordering = ['first_name']

    def get_queryset(self):
        user = self.request.user
        queryset = Client.objects.filter(professional=user)
        nome = self.request.query_params.get('nome')
        if nome:
            queryset = queryset.filter(first_name__icontains=nome)
        return queryset

    def perform_create(self, serializer):
        try:
            serializer.save(professional=self.request.user)
        except IntegrityError as e:
            msg = str(e).lower()
            if 'phone' in msg or 'phone_digits' in msg or 'register_client_phone' in msg:
                raise ValidationError({'phone': ['Este telefone já cadastrado']})
            raise

    def perform_update(self, serializer):
        try:
            serializer.save()
        except IntegrityError as e:
            msg = str(e).lower()
            if 'phone' in msg or 'phone_digits' in msg or 'register_client_phone' in msg:
                raise ValidationError({'phone': ['Este telefone já cadastrado']})
            raise


from django.db.models import Q, OuterRef, Subquery, DateTimeField, CharField
from django.utils import timezone
from apps.agenda.models import Appointment

class ClientBasicViewSet(ModelViewSet):
    serializer_class = ClientBasicSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        nome = self.request.query_params.get('nome', '').strip()
        base_qs = Client.objects.filter(professional=self.request.user)

        # Enriquecimento: próximo compromisso futuro (não inclui passado nem em andamento), exclui cancelados.
        # Requisito de negócio: mini card mostra apenas compromissos ainda não iniciados.
        now = timezone.now()
        appt_qs = (
            Appointment.objects.filter(
                professional=self.request.user,
                client_id=OuterRef('pk'),
            )
            .exclude(status=Appointment.Status.CANCELED)
            .filter(start_at__gte=now)
            .order_by('start_at')
        )
        last_appt_qs = (
            Appointment.objects.filter(
                professional=self.request.user,
                client_id=OuterRef('pk'),
            )
            .exclude(status=Appointment.Status.CANCELED)
            .filter(start_at__lt=now)
            .order_by('-start_at')
        )

        queryset = base_qs.annotate(
            next_appointment_start_at=Subquery(
                appt_qs.values('start_at')[:1], output_field=DateTimeField()
            ),
            next_appointment_end_at=Subquery(
                appt_qs.values('end_at')[:1], output_field=DateTimeField()
            ),
            next_appointment_title=Subquery(
                appt_qs.values('title')[:1], output_field=CharField()
            ),
            next_appointment_status=Subquery(
                appt_qs.values('status')[:1], output_field=CharField()
            ),
                next_appointment_notes=Subquery(
                    appt_qs.values('notes')[:1], output_field=CharField()
                ),
            next_appointment_id=Subquery(
                appt_qs.values('id')[:1]
            ),
            last_appointment_start_at=Subquery(
                last_appt_qs.values('start_at')[:1], output_field=DateTimeField()
            ),
            last_appointment_title=Subquery(
                last_appt_qs.values('title')[:1], output_field=CharField()
            ),
            last_appointment_status=Subquery(
                last_appt_qs.values('status')[:1], output_field=CharField()
            ),
            last_appointment_notes=Subquery(
                last_appt_qs.values('notes')[:1], output_field=CharField()
            ),
        )

        if nome:
            queryset = queryset.filter(
                Q(first_name__istartswith=nome) |
                Q(last_name__istartswith=nome)
            )

        return queryset.order_by('first_name')
