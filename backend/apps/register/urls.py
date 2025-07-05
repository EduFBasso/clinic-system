# urls do app register
# backend\apps\register\urls.py
from django.urls import path, include
from .views_auth import login_professional
from rest_framework.routers import DefaultRouter
from .views_clients import ClientViewSet, ClientBasicViewSet
from .views_professionals import ProfessionalViewSet, ProfessionalBasicViewSet

router = DefaultRouter()
router.register(r'clients', ClientViewSet, basename='client')
router.register(r'professionals', ProfessionalViewSet)
router.register(r'professionals-basic', ProfessionalBasicViewSet, basename='professional-basic')
router.register(r'clients-basic', ClientBasicViewSet, basename='client-basic')

urlpatterns = [
    path('login/', login_professional),
    path('', include(router.urls)),
]
