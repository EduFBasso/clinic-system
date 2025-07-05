# backend\apps\register\views.py

# 🔁 Integrações modulares com as views especializadas
from .views_clients import ClientViewSet, ClientBasicViewSet
from .views_professionals import ProfessionalViewSet, ProfessionalBasicViewSet
from .views_auth import login_professional

"""
📘 Módulo: views.py

Arquivo integrador dos ViewSets e funções refatoradas.

Importa as views divididas em:
- views_clients.py
- views_professionals.py
- views_auth.py

Serve como ponto único de entrada para urls.py.
Sem lógica direta implementada aqui.
"""