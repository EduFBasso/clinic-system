from django.contrib import admin

from .models import Appointment


@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "professional", "client", "start_at", "end_at", "status")
    list_filter = ("status", "visit_type", "professional")
    search_fields = ("title", "notes", "client__first_name", "client__last_name")
    autocomplete_fields = ("professional", "client")
