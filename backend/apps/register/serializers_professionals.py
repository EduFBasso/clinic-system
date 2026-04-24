from rest_framework import serializers
from .models import Professional
from rest_framework.permissions import BasePermission

class ProfessionalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Professional
        fields = [
            'id', 'email', 'first_name', 'last_name', 'display_name', 'register_number',
            'specialty', 'phone', 'city', 'state',
            'can_manage_professionals', 'is_active', 'is_staff', 'is_superuser',
            'created_at', 'deactivated_at', 'deactivation_reason',
            'ui_theme',
        ]
        extra_kwargs = {
            'can_manage_professionals': {'required': False},
        }


class ProfessionalBasicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Professional
        fields = ['id', 'email', 'first_name', 'last_name', 'display_name', 'register_number']


from rest_framework.permissions import BasePermission

class CanManageProfessionals(BasePermission):
    def has_permission(self, request, view) -> bool: # type: ignore[override]
        return request.user.is_authenticated and bool(getattr(request.user, 'can_manage_professionals', False))
    
      
