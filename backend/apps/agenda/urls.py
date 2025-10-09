from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import AppointmentViewSet, FinalizeAuditListView, IntegrationConsultationsListView

router = DefaultRouter()
router.register(r'appointments', AppointmentViewSet, basename='appointment')

urlpatterns = [
    path('', include(router.urls)),
    path('finalize-audits/', FinalizeAuditListView.as_view(), name='finalize-audits-list'),
    # Integração: consultas (somente leitura)
    path('integration/consultations/', IntegrationConsultationsListView.as_view(), name='integration-consultations-list'),
]
