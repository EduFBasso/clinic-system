# backend\apps\register\admin.py
from django.contrib import admin
from .models import Professional, Client, DeviceSession


@admin.register(Professional)
class ProfessionalAdmin(admin.ModelAdmin):
    """Admin simplificado para fluxo OTP: não solicita senha fixa.

    - Oculta o campo "password" do formulário.
    - Ao criar um profissional sem senha, define uma senha "inutilizável" (set_unusable_password).
    """

    list_display = (
        "first_name",
        "last_name",
        "email",
        "register_number",
        "is_active",
        "is_staff",
    )
    search_fields = ("first_name", "last_name", "email", "register_number")
    list_filter = ("is_active", "is_staff")
    # Oculta o campo de senha do formulário
    exclude = ("password",)
    readonly_fields = ("last_login", "created_at")

    fieldsets = (
        (None, {
            "fields": (
                "first_name",
                "last_name",
                "email",
                "phone",
                "register_number",
                "specialty",
                "can_manage_professionals",
            )
        }),
        ("Endereço", {"fields": ("city", "state")}),
        ("Permissões", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Datas", {"fields": ("last_login", "created_at")}),
    )
    filter_horizontal = ("groups", "user_permissions")

    def save_model(self, request, obj, form, change):
        # Para novos profissionais, se nenhuma senha foi fornecida (campo oculto),
        # garante que a conta não tenha senha fixa.
        if not change and not obj.password:
            obj.set_unusable_password()
        super().save_model(request, obj, form, change)


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ("first_name", "last_name", "email", "city", "state", "professional")
    search_fields = ("first_name", "last_name", "email")
    list_filter = ("professional", "city", "state")


@admin.register(DeviceSession)
class DeviceSessionAdmin(admin.ModelAdmin):
    list_display = ("professional", "device_id", "is_active", "created_at", "last_seen_at", "terminated_at")
    list_filter = ("is_active", "professional")
    search_fields = ("professional__email", "device_id")
    readonly_fields = ("created_at", "last_seen_at", "terminated_at")



