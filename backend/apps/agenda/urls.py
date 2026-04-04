from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    AppointmentViewSet,
    ChargeViewSet,
    ClinicalRecordViewSet,
    EncounterViewSet,
    FinalizeAuditListView,
    IntegrationConsultationsListView,
)

router = DefaultRouter()
router.register(r'appointments', AppointmentViewSet, basename='appointment')
router.register(r'encounters', EncounterViewSet, basename='encounter')
router.register(r'clinical-records', ClinicalRecordViewSet, basename='clinical-record')
router.register(r'charges', ChargeViewSet, basename='charge')

urlpatterns = [
    path('', include(router.urls)),
    path('finalize-audits/', FinalizeAuditListView.as_view(), name='finalize-audits-list'),
    # Integração: consultas (somente leitura)
    path('integration/consultations/', IntegrationConsultationsListView.as_view(), name='integration-consultations-list'),
]
