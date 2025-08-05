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
    cpf = models.CharField("CPF", max_length=14, unique=True, null=True, blank=True)

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
    sock_used = models.CharField("Meia usada", max_length=50, null=True, blank=True)

    # Atividades acadêmicas e esportivas
    sport_activity = models.CharField("Atividade esportiva", max_length=50, null=True, blank=True)
    academic_activity = models.CharField("Atividade acadêmica", max_length=50, null=True, blank=True)

    # Anamnese médica
    takes_medication = models.CharField("Toma medicação", max_length=50, null=True, blank=True)
    had_surgery = models.CharField("Já fez cirurgia", max_length=50, null=True, blank=True)
    is_pregnant = models.BooleanField("Está grávida", null=True, blank=True)

    pain_sensitivity = models.CharField("Sensibilidade à dor", max_length=50, null=True, blank=True)
    clinical_history = models.TextField("Histórico clínico", null=True, blank=True)

    # Avaliação dos pés
    plantar_view_left = models.TextField("Vista plantar esquerda", null=True, blank=True)
    plantar_view_right = models.TextField("Vista plantar direita", null=True, blank=True)

    dermatological_pathologies_left = models.TextField("Patologias pé esquerdo", null=True, blank=True)
    dermatological_pathologies_right = models.TextField("Patologias pé direito", null=True, blank=True)

    nail_changes_left = models.TextField("Alterações nas unhas pé esquerdo", null=True, blank=True)
    nail_changes_right = models.TextField("Alterações nas unhas pé direito", null=True, blank=True)

    deformities_left = models.TextField("Deformidades pé esquerdo", null=True, blank=True)
    deformities_right = models.TextField("Deformidades pé direito", null=True, blank=True)

    sensitivity_test = models.TextField("Teste de sensibilidade", null=True, blank=True)
    other_procedures = models.TextField("Outros procedimentos", null=True, blank=True)

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
 