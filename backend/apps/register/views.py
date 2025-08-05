# backend\apps\register\views.py
# 🔁 Integrações modulares com as views especializadas
from .client_views import ClientViewSet, ClientBasicViewSet
from .professional_views import ProfessionalViewSet, ProfessionalBasicViewSet
from .views_auth import login_professional