# urls do app register
# backend\apps\register\urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter

# ▶️ Importações de views
from .views_auth import login_professional
from .views_auth_code import request_otp_view, verify_code, logout_device
from .client_views import ClientViewSet, ClientBasicViewSet
from .professional_views import ProfessionalViewSet, ProfessionalBasicViewSet

# ▶️ ViewSets com rotas automáticas
router = DefaultRouter()
router.register(r'clients', ClientViewSet, basename='client')
router.register(r'clients-basic', ClientBasicViewSet, basename='client-basic')
router.register(r'professionals', ProfessionalViewSet)
router.register(r'professionals-basic', ProfessionalBasicViewSet, basename='professional-basic')

# ▶️ Rotas manuais
urlpatterns = [
    path('login/', login_professional),
    path('auth/request-code/', request_otp_view),
    path('auth/verify-code/', verify_code),
    path('auth/logout-device/', logout_device),
    path('', include(router.urls)),
]
