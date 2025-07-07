# backend\apps\register\tests\conftest.py

import django
import os
import pytest
from rest_framework.test import APIClient
from apps.register.models import Professional

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "clinic_project.settings")
django.setup()


@pytest.fixture
def profissional(db):
    return Professional.objects.create_user(
        email="prof@exemplo.com",
        password="123456",
        first_name="João",
        last_name="Silva",
        register_number="REG123"
    )

@pytest.fixture
def api_client(profissional):
    client = APIClient()
    response = client.post("/token/", {
        "email": profissional.email,
        "password": "123456"
    })
    token = response.data["access"]
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client

@pytest.fixture
def admin_user(db):
    return Professional.objects.create_user(
        email="adminapi@clinica.com",
        password="SenhaForte123!",
        first_name="Super",
        last_name="Usuário",
        is_staff=True  # caso você queira usar permissões mais tarde
    )

@pytest.fixture
def admin_client(admin_user):
    client = APIClient()
    response = client.post("/token/", {
        "email": admin_user.email,
        "password": "SenhaForte123!"
    })
    token = response.data["access"]
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


@pytest.fixture
def lucas(db):
    return Professional.objects.create_user(
        email="lucas@clinica.com",
        password="Senha123!",
        first_name="Lucas",
        last_name="Pereira",
        register_number="REG456"
    )

@pytest.fixture
def lucas_client(lucas):
    client = APIClient()
    response = client.post("/token/", {
        "email": lucas.email,
        "password": "Senha123!"
    })
    token = response.data["access"]
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


"""
📘 Módulo: conftest.py

Fornece fixtures globais para os testes do app:

- profissional / api_client: profissional autenticado com JWT
- admin_user / admin_client: usuário com privilégios administrativos
- lucas / lucas_client: segundo profissional para testes paralelos
"""