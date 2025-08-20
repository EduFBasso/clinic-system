# backend\apps\register\serializers_professionals.py
from rest_framework import serializers
from .models import Professional
from rest_framework.permissions import BasePermission

class ProfessionalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Professional
        fields = '__all__'
        extra_kwargs = {
            'password': {'required': False, 'write_only': True},
            'can_manage_professionals': {'required': False}
        }


class ProfessionalBasicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Professional
        fields = ['id', 'email', 'first_name', 'last_name', 'register_number']


from rest_framework.permissions import BasePermission

class CanManageProfessionals(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and getattr(request.user, 'can_manage_professionals', False)
    
      
