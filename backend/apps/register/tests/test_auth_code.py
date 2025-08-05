# backend/apps/register/tests/test_auth_code.py
import pytest
from apps.register.models import AccessCode, Professional
from django.utils import timezone
from datetime import timedelta

@pytest.mark.django_db
def test_request_code_sucesso(client):
    prof = Professional.objects.create_user(
        email="otp@clinica.com",
        first_name="OTP",
        last_name="Tester",
        password=None
    )
    response = client.post("/register/auth/request-code/", {
        "email": prof.email
    })
    assert response.status_code == 200
    assert AccessCode.objects.filter(professional=prof).exists()

@pytest.mark.django_db
def test_verify_code_valido(client):
    prof = Professional.objects.create_user(
        email="verify@clinica.com",
        first_name="Valida",
        last_name="Código"
    )
    code = AccessCode.objects.create(
        professional=prof,
        code="1234",
        expires_at=timezone.now() + timedelta(minutes=10)
    )
    response = client.post("/register/auth/verify-code/", {
        "email": prof.email,
        "code": "1234"
    })
    assert response.status_code == 200
    assert "access" in response.data