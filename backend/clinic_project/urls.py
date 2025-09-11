# urls do projeto
# backend\clinic_project\urls.py
from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from django.db import connection
from django.views.generic import RedirectView
from apps.register.authentication import EmailTokenObtainPairView
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    # Redirect root to the admin UI to make the admin entry point easy to find
    path('', RedirectView.as_view(url='/admin/', permanent=False)),
    # Health check endpoint (public) for uptime monitors and warm-up
    path('health/', lambda request: JsonResponse({'status': 'ok'})),  # liveness
    path('health', lambda request: JsonResponse({'status': 'ok'})),   # liveness (no slash)
    # readiness: inclui verificação mínima de banco
    path('health/full', (lambda request: (
        (lambda db_ok: JsonResponse({
            'status': 'ok' if db_ok else 'degraded',
            'database': 'ok' if db_ok else 'error'
        }))(
            # tentativa simples de ping no banco
            (lambda: (
                connection.ensure_connection() or True
            ))() if True else False
        )
    ))),
    path('admin/', admin.site.urls),
    path('register/', include('apps.register.urls')),  # 🧩 Rotas do app clínico
    path('agenda/', include('apps.agenda.urls')),

    # 🔐 JWT endpoints
    path('token/', EmailTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]
