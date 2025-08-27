# backend\apps\register\client_views.py
from rest_framework import filters
from rest_framework.exceptions import ValidationError
from django.db import IntegrityError
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ModelViewSet
from .models import Client
from .serializers import ClientSerializer, ClientBasicSerializer


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


from django.db.models import Q

class ClientBasicViewSet(ModelViewSet):
    serializer_class = ClientBasicSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        nome = self.request.query_params.get('nome', '').strip()
        queryset = Client.objects.filter(professional=self.request.user)

        if nome:
            queryset = queryset.filter(
                Q(first_name__istartswith=nome) |
                Q(last_name__istartswith=nome)
            )
        
        return queryset.order_by('first_name')
