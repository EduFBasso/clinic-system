backend/
├── apps/
│ └── register/
│ ├── admin.py
│ ├── apps.py
│ ├── authentication.py
│ ├── client_views.py
│ ├── professional_views.py
│ ├── serializers.py
│ ├── serializers_auth.py
│ ├── serializers_clients.py
│ ├── serializers_professionals.py
│ ├── services/
│ │ ├── access_code.py
│ │ ├── notifications.py
│ │ ├── otp_service.py
│ │ └── validation_utils.py
│ ├── tests.py
│ ├── urls.py
│ ├── views.py
│ ├── views_auth.py
│ ├── views_auth_code.py
│ ├── models.py
│ └── ...
├── clinic_project/
│ ├── asgi.py
│ ├── settings.py
│ ├── urls.py
│ └── wsgi.py
└── requirements.txt

Path: backend\apps\register\services

# apps.register.services.access_code.py

from datetime import datetime, timedelta
from secrets import randbelow
from apps.register.models import AccessCode, Professional
from django.utils import timezone

def generate_access_code(professional: Professional) -> AccessCode:
"""
Gera um código de acesso aleatório de 4 dígitos e o registra com
expiração de 10 minutos.
"""
code = f"{randbelow(10000):04}" # Formata com zeros à esquerda
expires_at = timezone.now() + timedelta(minutes=10)

    return AccessCode.objects.create(
        professional=professional,
        code=code,
        expires_at=expires_at
    )

# backend\apps\register\services\notifications.py

import logging
from django.core.mail import send_mail
from django.conf import settings
from apps.register.models import Professional

logger = logging.getLogger(**name**)

def send_code_email(professional: Professional, code: str) -> None:
"""
Envia o código OTP por e-mail para o profissional especificado.
"""
if not professional.email:
logger.warning(f"Profissional sem e-mail: {professional}")
return

    subject = "📌 Seu código de acesso"
    message = f"""

Olá {professional.first_name},

Seu código de verificação é: {code}

Este código é válido por 10 minutos.
Se você não solicitou este acesso, ignore este e-mail.

Equipe Clínica
""".strip()

    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[professional.email],
            fail_silently=False
        )
        logger.info(f"E-mail enviado com sucesso para {professional.email}: código {code}")
    except Exception as e:
        logger.error(f"Erro ao enviar e-mail para {professional.email}: {str(e)}")

# Integração com WhatsApp (simulação)

logger = logging.getLogger(**name**)

def send_code_whatsapp(phone_number: str, code: str) -> None:
"""
Simula o envio de código OTP via WhatsApp para o número especificado.
A chamada real da API está comentada.
"""
if not phone_number:
logger.warning("Nenhum número de telefone fornecido para envio via WhatsApp.")
return

    # Simulação de formatação do número internacional
    formatted = format_whatsapp_number(phone_number)
    message = f"🔐 Seu código de acesso é: {code} (válido por 10 minutos)"

    # Simulação no terminal
    logger.info(f"[Simulação WhatsApp] Enviando para {formatted}: {message}")

        # Integração futura (exemplo com API fictícia):
        # import requests
        # response = requests.post("https://api.whatsapp-gateway.com/send", json={
        #     "to": formatted,
        #     "message": message,
        #     "auth": {"api_key": "SUA_CHAVE_AQUI"}
        # })
        # if response.status_code != 200:
        #     logger.error(f"Erro ao enviar WhatsApp: {response.text}")

    def format_whatsapp_number(raw_number: str) -> str:
        """
        Formata o número bruto para padrão internacional (+55...).
        Aceita números com DDD e remove caracteres extras.
        """
        import re
        digits = re.sub(r'\D', '', raw_number)  # Remove tudo que não for número
        if digits.startswith("55"):
            return f"+{digits}"
        return f"+55{digits}"

# backend\apps\register\services\otp_service.py

from apps.register.models import Professional, AccessCode
from apps.register.services.access_code import generate_access_code
from apps.register.services.notifications import send_code_email
from django.utils import timezone

def request_otp_code(email):
try:
profissional = Professional.objects.get(email=email)
code_entry = generate_access_code(profissional)
send_code_email(profissional, code_entry.code)
return {"success": True, "message": "Código enviado com sucesso."}
except Professional.DoesNotExist:
return {"success": False, "message": "Profissional não encontrado."}

from django.utils import timezone
from apps.register.models import AccessCode, Professional

def validate_otp_code(email: str, code: str):
try:
professional = Professional.objects.get(email=email)
except Professional.DoesNotExist:
return {"valid": False, "message": "Profissional não encontrado."}

    access_code = AccessCode.objects.filter(
        professional=professional,
        code=code
    ).first()

    if not access_code:
        return {"valid": False, "message": "Código não encontrado para este profissional."}

    if access_code.is_used:
        return {"valid": False, "message": "Código já utilizado."}

    if access_code.expires_at < timezone.now():
        return {"valid": False, "message": "Código expirado."}

    # Código está OK!
    access_code.is_used = True
    access_code.save()
    return {"valid": True, "message": "Código validado com sucesso."}

# backend\apps\register\services\validation_utils.py

import re
import logging

def is_valid_email(email):
return re.match(r"[^@]+@[^@]+\.[^@]+", email) is not None

def is_valid_code(code):
return code.isdigit() and len(code) == 4

# Path: backend\apps\register

# backend\apps\register\admin.py

from django.contrib import admin
from .models import Professional, Client

admin.site.register(Professional)

@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
list_display = ("first_name", "last_name", "email", "city", "state", "professional")
search_fields = ("first_name", "last_name", "email")
list_filter = ("professional", "city", "state")

# backend\apps\register\authentication.py

from rest_framework_simplejwt.views import TokenObtainPairView
from .serializers import CustomTokenObtainPairSerializer

class EmailTokenObtainPairView(TokenObtainPairView):
serializer_class = CustomTokenObtainPairSerializer

# backend\apps\register\client_views.py

from rest_framework import filters
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ModelViewSet
from .models import Client
from .serializers import ClientSerializer, ClientBasicSerializer

class ClientViewSet(ModelViewSet):
serializer_class = ClientSerializer
permission_classes = [IsAuthenticated]
filter_backends = [filters.OrderingFilter]
ordering_fields = ['first_name', 'last_name', 'city', 'state']
ordering = ['first_name']

    def get_queryset(self):
        user = self.request.user
        queryset = Client.objects.filter(professional=user)
        nome = self.request.query_params.get('nome')
        if nome:
            queryset = queryset.filter(first_name__icontains=nome)
        return queryset

    def perform_create(self, serializer):
        serializer.save(professional=self.request.user)

class ClientBasicViewSet(ModelViewSet):
serializer_class = ClientBasicSerializer
permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Client.objects.filter(professional=self.request.user)

# backend\apps\register\views_professionals.py

from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.viewsets import ModelViewSet
from .models import Professional
from .serializers import ProfessionalSerializer, ProfessionalBasicSerializer

class ProfessionalViewSet(ModelViewSet):
queryset = Professional.objects.all()
serializer_class = ProfessionalSerializer
permission_classes = [IsAuthenticated]

class ProfessionalBasicViewSet(ModelViewSet):
queryset = Professional.objects.all()
serializer_class = ProfessionalBasicSerializer
permission_classes = [AllowAny]

# backend\apps\register\views_auth_code.py

from rest_framework.response import Response
from rest_framework.decorators import api_view
from rest_framework import status
from django.utils import timezone
from apps.register.models import Professional, AccessCode
from apps.register.serializers import ProfessionalSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from apps.register.services.validation_utils import is_valid_email
from apps.register.services.otp_service import request_otp_code
import logging

@api_view(['POST'])
def request_otp_view(request):
email = request.data.get('email')

    if not is_valid_email(email):
        return Response({'error': 'E-mail inválido.'}, status=400)

    resultado = request_otp_code(email)

    if resultado['success']:
        return Response({'message': resultado['message']})
    else:
        return Response({'error': resultado['message']}, status=404)

logger = logging.getLogger(**name**)

@api_view(["POST"])
def verify_code(request):
email = request.data.get("email")
code = request.data.get("code")

    logger.info(f"[Verificação OTP] E-mail: {email} | Código: {code}")

    try:
        professional = Professional.objects.get(email=email)
    except Professional.DoesNotExist:
        return Response(
            {"valid": False, "message": "Profissional não encontrado."},
            status=status.HTTP_404_NOT_FOUND
        )

    access_code = AccessCode.objects.filter(
        professional=professional,
        code=code
    ).first()

    if not access_code:
        return Response(
            {"valid": False, "message": "Código não encontrado para este profissional."},
            status=status.HTTP_404_NOT_FOUND
        )

    if access_code.is_used:
        return Response(
            {"valid": False, "message": "Código já utilizado."},
            status=status.HTTP_400_BAD_REQUEST
        )

    if access_code.expires_at < timezone.now():
        return Response(
            {"valid": False, "message": "Código expirado."},
            status=status.HTTP_401_UNAUTHORIZED
        )

    # ✅ Tudo certo — marcar como usado
    access_code.is_used = True
    access_code.save()

    # Gerar JWT
    refresh = RefreshToken.for_user(professional)
    access_token = str(refresh.access_token)
    refresh_token = str(refresh)

    logger.info(f"[Código Validado] Profissional: {professional.email} | Código: {code}")

    return Response(
        {
            "access": access_token,
            "refresh": refresh_token,
            "professional": ProfessionalSerializer(professional).data
        },
        status=status.HTTP_200_OK
    )

# backend.apps.register.views_auth.py

from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth import authenticate

@csrf_exempt
@api_view(['POST'])
def login_professional(request):
email = request.data.get('email')
password = request.data.get('password')
user = authenticate(username=email, password=password)

    if user:
        return Response({
            'id': user.id,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'register_number': user.register_number,
            'specialty': user.specialty
        })

    return Response({'error': 'Credenciais inválidas'}, status=401)

# backend\apps\register\views.py

# 🔁 Integrações modulares com as views especializadas

from .client_views import ClientViewSet, ClientBasicViewSet
from .professional_views import ProfessionalViewSet, ProfessionalBasicViewSet
from .views_auth import login_professional

# backend\apps\register\models.py

# backend/apps/register/models.py

from phonenumber_field.modelfields import PhoneNumberField
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager

class ProfessionalManager(BaseUserManager):
def create_user(self, email, password=None, \*\*extra_fields):
if not email:
raise ValueError("O e-mail é obrigatório")

        email = self.normalize_email(email)
        extra_fields.setdefault("is_staff", False)       # Não é staff
        extra_fields.setdefault("is_superuser", False)   # Nem superusuário

        user = self.model(email=email, **extra_fields)

        if password:
            user.set_password(password)  # Criptografa a senha
        else:
            user.set_unusable_password() # Se for login via código/OTP

        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        # Apenas para uso interno, por exemplo: Django Admin
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(email, password, **extra_fields)

class Professional(AbstractBaseUser, PermissionsMixin):
first_name = models.CharField("Nome", max_length=50)
last_name = models.CharField("Sobrenome", max_length=70)
phone = PhoneNumberField("Telefone", region="BR", blank=True)
email = models.EmailField("E-mail", unique=True)

    register_number = models.CharField(
        "Registro Profissional",
        max_length=30,
        unique=True,
        blank=True,
        null=True
    )
    specialty = models.CharField("Especialidade", max_length=100, blank=True)
    can_manage_professionals = models.BooleanField(
    default=False,
    verbose_name="Pode gerenciar profissionais"

)

    # Endereço
    city = models.CharField("Cidade", max_length=50, blank=True)
    state = models.CharField("Estado", max_length=2, blank=True)

    is_staff = models.BooleanField(default=True)
    is_active = models.BooleanField("Ativo", default=True)
    created_at = models.DateTimeField("Criado em", auto_now_add=True)

    objects = ProfessionalManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]

    def __str__(self):
        return f"{self.first_name} {self.last_name} — {self.register_number}"

class Client(models.Model):
professional = models.ForeignKey(
"Professional",
on_delete=models.CASCADE,
related_name="clients",
verbose_name="Profissional"
)

    # Pessoais
    first_name = models.CharField("Primeiro nome", max_length=255)
    last_name = models.CharField("Sobrenome", max_length=255)
    email = models.EmailField("E-mail", unique=True, null=True, blank=True)
    phone = models.CharField("Telefone", max_length=20, null=True, blank=True)

    # Endereço
    address_street = models.CharField("Rua", max_length=255, null=True, blank=True)
    address_number = models.CharField("Número", max_length=10, null=True, blank=True)
    city = models.CharField("Cidade", max_length=100, null=True, blank=True)
    state = models.CharField("Estado", max_length=2, null=True, blank=True)
    postal_code = models.CharField("CEP", max_length=20, null=True, blank=True)

    # Registro
    created_at = models.DateTimeField("Criado em", auto_now_add=True)
    updated_at = models.DateTimeField("Atualizado em", auto_now=True)

    # Anamnese básica
    footwear_used = models.CharField("Calçado usado", max_length=50, null=True, blank=True)
    footwear_other = models.TextField("Outro calçado", null=True, blank=True)
    sock_used = models.CharField("Meia usada", max_length=50, null=True, blank=True)

    takes_medication = models.BooleanField("Toma medicação", null=True, blank=True)
    medication_details = models.TextField("Detalhes da medicação", null=True, blank=True)

    had_surgery = models.BooleanField("Já fez cirurgia", null=True, blank=True)
    surgery_details = models.TextField("Detalhes da cirurgia", null=True, blank=True)

    is_pregnant = models.BooleanField("Está grávida", null=True, blank=True)
    pregnancy_details = models.TextField("Detalhes da gravidez", null=True, blank=True)

    pain_sensitivity = models.CharField("Sensibilidade à dor", max_length=50, null=True, blank=True)
    clinical_history = models.TextField("Histórico clínico", null=True, blank=True)
    clinical_history_other = models.TextField("Outro histórico", null=True, blank=True)

    # Avaliação física
    perfusion_left = models.CharField("Perfusão pé esquerdo", max_length=50, null=True, blank=True)
    perfusion_left_other = models.TextField("Outra perfusão esquerda", null=True, blank=True)

    perfusion_right = models.CharField("Perfusão pé direito", max_length=50, null=True, blank=True)
    perfusion_right_other = models.TextField("Outra perfusão direita", null=True, blank=True)

    plantar_view_left = models.TextField("Vista plantar esquerda", null=True, blank=True)
    plantar_view_left_other = models.TextField("Outra vista plantar esquerda", null=True, blank=True)

    plantar_view_right = models.TextField("Vista plantar direita", null=True, blank=True)
    plantar_view_right_other = models.TextField("Outra vista plantar direita", null=True, blank=True)

    dermatological_pathologies_left = models.TextField("Patologias pé esquerdo", null=True, blank=True)
    dermatological_pathologies_right = models.TextField("Patologias pé direito", null=True, blank=True)

    professional_procedures = models.TextField("Procedimentos realizados", null=True, blank=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name}"

# apps.register.models.py

class AccessCode(models.Model):
professional = models.ForeignKey(Professional, on_delete=models.CASCADE)
code = models.CharField(max_length=4)
expires_at = models.DateTimeField()
is_used = models.BooleanField(default=False)
created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.professional.email} — Código {self.code}"

# backend\apps\register\serializers_auth.py

from rest*framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework import serializers
from django.contrib.auth import authenticate
from django.utils.translation import gettext_lazy as *

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer): # Garantimos que o campo de entrada é 'email' + 'password'
username_field = 'email'

    def validate(self, attrs):
        email = attrs.get("email")
        password = attrs.get("password")

        user = authenticate(username=email, password=password)

        if user is None:
            raise serializers.ValidationError(_("Credenciais inválidas ou profissional não encontrado."))

        if not user.is_active:
            raise serializers.ValidationError(_("Essa conta está desativada."))

        data = super().validate(attrs)

        # Adiciona dados extras ao payload do frontend
        data['professional'] = {
            'id': user.id,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'email': user.email,
            'register_number': user.register_number,
            'specialty': user.specialty
        }

        return data

    # backend\apps\register\serializers_professionals.py

from rest_framework import serializers
from .models import Professional
from rest_framework.permissions import BasePermission

class ProfessionalSerializer(serializers.ModelSerializer):
class Meta:
model = Professional
fields = '**all**'
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

# backend\apps\register\serializers_clients.py

from rest_framework import serializers
from .models import Client

class ClientSerializer(serializers.ModelSerializer):
takes_medication = serializers.BooleanField(required=False)
had_surgery = serializers.BooleanField(required=False)
is_pregnant = serializers.BooleanField(required=False)
professional = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Client
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']
        extra_kwargs = {
            "email": {"required": False, "allow_null": True, "allow_blank": True},
            "phone": {"required": False, "allow_null": True, "allow_blank": True},
            "city": {"required": False, "allow_null": True, "allow_blank": True},
            "state": {"required": False, "allow_null": True, "allow_blank": True},
            "postal_code": {"required": False, "allow_null": True, "allow_blank": True},
            "address_street": {"required": False, "allow_null": True, "allow_blank": True},
            "address_number": {"required": False, "allow_null": True, "allow_blank": True},
            "medication_details": {"required": False, "allow_null": True, "allow_blank": True},
            "surgery_details": {"required": False, "allow_null": True, "allow_blank": True},
            "pregnancy_details": {"required": False, "allow_null": True, "allow_blank": True},
            "pain_sensitivity": {"required": False, "allow_null": True, "allow_blank": True},
            "footwear_used": {"required": False, "allow_null": True, "allow_blank": True},
            "footwear_other": {"required": False, "allow_null": True, "allow_blank": True},
            "sock_used": {"required": False, "allow_null": True, "allow_blank": True},
            "clinical_history": {"required": False, "allow_null": True, "allow_blank": True},
            "clinical_history_other": {"required": False, "allow_null": True, "allow_blank": True},
            "professional_procedures": {"required": False, "allow_null": True, "allow_blank": True},
            # Continua com o restante dos campos clínicos…
        }

class ClientBasicSerializer(serializers.ModelSerializer):
class Meta:
model = Client
fields = [
'id', 'first_name', 'last_name', 'phone',
'address_street', 'address_number', 'city', 'state'
]

# backend\apps\register\serializers_professionals.py

from rest_framework import serializers
from .models import Professional
from rest_framework.permissions import BasePermission

class ProfessionalSerializer(serializers.ModelSerializer):
class Meta:
model = Professional
fields = '**all**'
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

# backend/apps/register/serializers.py

from .serializers_clients import ClientSerializer, ClientBasicSerializer
from .serializers_professionals import (
ProfessionalSerializer,
ProfessionalBasicSerializer
)
from .serializers_auth import CustomTokenObtainPairSerializer

# urls do app register

# backend\apps\register\urls.py

from django.urls import path, include
from rest_framework.routers import DefaultRouter

# ▶️ Importações de views

from .views_auth import login_professional
from .views_auth_code import request_otp_view, verify_code
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
path('', include(router.urls)),
]

# backend\clinic_project

# backend\clinic_project\settings.py

from decouple import config
from pathlib import Path
import os

BASE_DIR = Path(**file**).resolve().parent.parent

SECRET_KEY = config("DJANGO_SECRET_KEY", default="fallback-key-only-for-dev")

DEBUG = True

ALLOWED_HOSTS = []

INSTALLED_APPS = [
'rest_framework',
'apps.register',
'django.contrib.admin',
'django.contrib.auth',
'django.contrib.contenttypes',
'django.contrib.sessions',
'django.contrib.messages',
'django.contrib.staticfiles',
'corsheaders',
]

AUTH_USER_MODEL = 'register.Professional'

MIDDLEWARE = [
'django.middleware.security.SecurityMiddleware',
'django.contrib.sessions.middleware.SessionMiddleware',
'corsheaders.middleware.CorsMiddleware',
'django.middleware.common.CommonMiddleware',
'django.middleware.csrf.CsrfViewMiddleware',
'django.contrib.auth.middleware.AuthenticationMiddleware',
'django.contrib.messages.middleware.MessageMiddleware',
'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

CORS_ALLOWED_ORIGINS = [
"http://localhost:5173", # Vite
"http://127.0.0.1:5173",
]

ROOT_URLCONF = 'clinic_project.urls'

TEMPLATES = [
{
'BACKEND': 'django.template.backends.django.DjangoTemplates',
'DIRS': [],
'APP_DIRS': True,
'OPTIONS': {
'context_processors': [
'django.template.context_processors.request',
'django.contrib.auth.context_processors.auth',
'django.contrib.messages.context_processors.messages',
],
},
},
]

WSGI_APPLICATION = 'clinic_project.wsgi.application'

DATABASES = {
'default': {
'ENGINE': 'django.db.backends.mysql',
'NAME': config("DB_NAME"),
'USER': config("DB_USER"),
'PASSWORD': config("DB_PASSWORD"),
'HOST': config("DB_HOST", default="localhost"),
'PORT': config("DB_PORT", default="3306"),
}
}

AUTH_PASSWORD_VALIDATORS = [
{
'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
},
{
'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
},
{
'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
},
{
'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
},
]

USE_I18N = True
LOCALE_PATHS = [os.path.join(BASE_DIR, 'locale')]
LANGUAGE_CODE = 'pt-br'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True
STATIC_URL = 'static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
'DEFAULT_AUTHENTICATION_CLASSES': (
'rest_framework_simplejwt.authentication.JWTAuthentication',
)
}

from datetime import timedelta

SIMPLE_JWT = {
"ACCESS_TOKEN_LIFETIME": timedelta(hours=12), # token de acesso válido por 12h
"REFRESH_TOKEN_LIFETIME": timedelta(days=1), # opcional, se quiser usar depois
"ROTATE_REFRESH_TOKENS": False,
"BLACKLIST_AFTER_ROTATION": False,
"AUTH_HEADER_TYPES": ("Bearer",),
}

EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = config("EMAIL_HOST")
EMAIL_PORT = config("EMAIL_PORT", cast=int)
EMAIL_HOST_USER = config("EMAIL_HOST_USER")
EMAIL_HOST_PASSWORD = config("EMAIL_HOST_PASSWORD")
EMAIL_USE_TLS = config("EMAIL_USE_TLS", cast=bool)
DEFAULT_FROM_EMAIL = config("DEFAULT_FROM_EMAIL")

# urls do projeto

# backend\clinic_project\urls.py

from django.contrib import admin
from django.urls import path, include
from apps.register.authentication import EmailTokenObtainPairView
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
path('admin/', admin.site.urls),
path('register/', include('apps.register.urls')), # 🧩 Rotas do app clínico

    # 🔐 JWT endpoints
    path('token/', EmailTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

]

arquivos asgi e wsgi.py não foram alterados desde a criação do projeo.
