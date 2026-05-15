from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'fields', views.AnamnesisFieldViewSet, basename='anamnesis-field')
router.register(r'responses', views.AnamnesisResponseViewSet, basename='anamnesis-response')

urlpatterns = [
    path('', include(router.urls)),
]
