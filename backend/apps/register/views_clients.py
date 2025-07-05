# backend\apps\register\views_clients.py

from rest_framework import filters
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
        serializer.save(professional=self.request.user)


class ClientBasicViewSet(ModelViewSet):
    serializer_class = ClientBasicSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Client.objects.filter(professional=self.request.user)
    
"""
🧭 Módulo: views_clients.py

Responsável por operações de CRUD de clientes autenticados:
- ClientViewSet: ações completas (criar, listar, atualizar, deletar)
- ClientBasicViewSet: listagem leve, sem dados sensíveis

Utiliza:
- filtros por nome (get_queryset)
- ordenação via query (?ordering=...)
- autenticação IsAuthenticated
"""
