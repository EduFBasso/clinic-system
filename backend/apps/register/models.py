# backend/apps/register/models.py
from phonenumber_field.modelfields import PhoneNumberField
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager


class ProfessionalManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
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

    register_number = models.CharField("Registro Profissional", max_length=30, unique=True)
    specialty = models.CharField("Especialidade", max_length=100, blank=True)
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
    professional = models.ForeignKey(Professional, on_delete=models.CASCADE, related_name="clients")

    # Pessoais
    first_name = models.CharField("Primeiro nome", max_length=255)
    last_name = models.CharField("Sobrenome", max_length=255)
    email = models.EmailField("E-mail", unique=True)
    phone = models.CharField("Telefone", max_length=20, null=True, blank=True)

    # Endereço
    address_street = models.CharField("Rua", max_length=255, blank=True)
    address_number = models.CharField("Número", max_length=10, blank=True)
    city = models.CharField("Cidade", max_length=100, blank=True)
    state = models.CharField("Estado", max_length=2, blank=True)
    postal_code = models.CharField("CEP", max_length=20, blank=True)

    # Registro
    created_at = models.DateTimeField("Criado em", auto_now_add=True)
    updated_at = models.DateTimeField("Atualizado em", auto_now=True)

    # Anamnese básica
    footwear_used = models.CharField("Calçado usado", max_length=50, blank=True)
    footwear_other = models.TextField("Outro calçado", blank=True)
    sock_used = models.CharField("Meia usada", max_length=50, blank=True)

    takes_medication = models.BooleanField("Toma medicação", null=True)
    medication_details = models.TextField("Detalhes da medicação", blank=True)

    had_surgery = models.BooleanField("Já fez cirurgia", null=True)
    surgery_details = models.TextField("Detalhes da cirurgia", blank=True)

    is_pregnant = models.BooleanField("Está grávida", null=True)
    pregnancy_details = models.TextField("Detalhes da gravidez", blank=True)

    pain_sensitivity = models.CharField("Sensibilidade à dor", max_length=50, blank=True)
    clinical_history = models.TextField("Histórico clínico", blank=True)
    clinical_history_other = models.TextField("Outro histórico", blank=True)

    # Avaliação física
    perfusion_left = models.CharField("Perfusão pé esquerdo", max_length=50, blank=True)
    perfusion_left_other = models.TextField("Outra perfusão esquerda", blank=True)

    perfusion_right = models.CharField("Perfusão pé direito", max_length=50, blank=True)
    perfusion_right_other = models.TextField("Outra perfusão direita", blank=True)

    plantar_view_left = models.TextField("Vista plantar esquerda", blank=True)
    plantar_view_left_other = models.TextField("Outra vista plantar esquerda", blank=True)

    plantar_view_right = models.TextField("Vista plantar direita", blank=True)
    plantar_view_right_other = models.TextField("Outra vista plantar direita", blank=True)

    dermatological_pathologies_left = models.TextField("Patologias pé esquerdo", blank=True)
    dermatological_pathologies_right = models.TextField("Patologias pé direito", blank=True)

    professional_procedures = models.TextField("Procedimentos realizados", blank=True)

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
    
"""
    📦 Modelos Definidos
1. ProfessionalManager
- Gerencia criação de profissionais e superusuários
- Trata criptografia de senha ou uso de senha descartável (OTP)
2. Professional
- Usuário principal do sistema
- Campos: nome, email, telefone, número de registro profissional, especialidade, cidade/estado
- Personalizado para login via e-mail (USERNAME_FIELD = "email")
- Suporte a autenticação via Django (AbstractBaseUser e PermissionsMixin)
3. Client
- Associado a um Professional via ForeignKey
- Campos divididos em:
- Dados pessoais e de contato
- Endereço completo
- Anamnese clínica: medicação, cirurgias, gravidez, sensibilidade
- Avaliação física: perfusão, vista plantar, dermatologia
- Observações sobre procedimentos realizados
- Registro automático de criação/atualização (created_at, updated_at)
4. AccessCode
- Sistema de código temporário para login seguro via OTP
- Campos:
- professional: vínculo com usuário
- code: string de 4 dígitos
- expires_at: data de validade
- is_used: controle de uso único
- created_at: registro automático
"""

