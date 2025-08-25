# urls do projeto
# backend\clinic_project\urls.py
from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from django.views.generic import RedirectView
from apps.register.authentication import EmailTokenObtainPairView
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    # Redirect root to the admin UI to make the admin entry point easy to find
    path('', RedirectView.as_view(url='/admin/', permanent=False)),
    # Health check endpoint (public) for uptime monitors and warm-up
    path('health/', lambda request: JsonResponse({'status': 'ok'})),
    # Accept /health without trailing slash as well
    path('health', lambda request: JsonResponse({'status': 'ok'})),
    path('admin/', admin.site.urls),
    path('register/', include('apps.register.urls')),  # 🧩 Rotas do app clínico

    # 🔐 JWT endpoints
    path('token/', EmailTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]
