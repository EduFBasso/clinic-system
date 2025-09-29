from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import AppointmentViewSet, FinalizeAuditListView

router = DefaultRouter()
router.register(r'appointments', AppointmentViewSet, basename='appointment')

urlpatterns = [
    path('', include(router.urls)),
    path('finalize-audits/', FinalizeAuditListView.as_view(), name='finalize-audits-list'),
]
