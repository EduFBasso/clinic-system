# urls do projeto
# backend\clinic_project\urls.py
from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from django.db import connection
from django.utils import timezone
from django.conf import settings
from django.views.generic import RedirectView
from apps.register.authentication import EmailTokenObtainPairView
from rest_framework_simplejwt.views import TokenRefreshView

def health_view(_request):
    return JsonResponse({'status': 'ok'})

def full_health_view(_request):
    db_ok = True
    try:
        connection.ensure_connection()
    except Exception:
        db_ok = False
    return JsonResponse({
        'status': 'ok' if db_ok else 'degraded',
        'database': 'ok' if db_ok else 'error',
        'version': getattr(settings, 'APP_VERSION', 'unknown'),
        'time': timezone.now().isoformat(),
    })

urlpatterns = [
    # Redirect root to the admin UI to make the admin entry point easy to find
    path('', RedirectView.as_view(url='/admin/', permanent=False)),
    # Health check endpoint (public) for uptime monitors and warm-up
    path('health/', health_view),  # liveness
    path('health', health_view),   # liveness (no slash)
    path('health/full', full_health_view),  # readiness + metadata
    path('admin/', admin.site.urls),
    path('register/', include('apps.register.urls')),  # 🧩 Rotas do app clínico
    path('agenda/', include('apps.agenda.urls')),

    # 🔐 JWT endpoints
    path('token/', EmailTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]
