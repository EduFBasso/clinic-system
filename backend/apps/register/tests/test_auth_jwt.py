import pytest
import pyotp
from django.urls import reverse
from django.test import override_settings
from django.utils import timezone
from apps.register.models import Professional
from rest_framework.test import APIClient


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def professional(db):
    return Professional.objects.create_user(
        email='authpro@example.com', password='secret123', first_name='Auth', last_name='Pro'
    )


def test_obtain_token_pair(api_client, professional):
    url = '/token/'
    r = api_client.post(url, {'email': professional.email, 'password': 'secret123'}, format='json')
    assert r.status_code == 200, r.content
    data = r.json()
    assert 'access' in data and 'refresh' in data


def test_refresh_token(api_client, professional):
    obtain = api_client.post('/token/', {'email': professional.email, 'password': 'secret123'}, format='json')
    refresh = obtain.json()['refresh']
    r = api_client.post('/token/refresh/', {'refresh': refresh}, format='json')
    assert r.status_code == 200
    assert 'access' in r.json()


import pytest

@pytest.mark.django_db
def test_invalid_credentials(api_client):
    # Precisa de acesso ao banco para que o backend de auth consulte usuários inexistentes
    # (django contrib auth faz query mesmo para credenciais inválidas)
    r = api_client.post('/token/', {'email': 'x@y.com', 'password': 'wrong'}, format='json')
    assert r.status_code in (400, 401)


@pytest.mark.django_db
@override_settings(TOTP_VALID_WINDOW=2)
def test_totp_verify_accepts_code_with_60_second_clock_skew(api_client, professional):
    professional.totp_secret = pyotp.random_base32()
    professional.save(update_fields=['totp_secret'])

    skewed_code = pyotp.TOTP(professional.totp_secret).at(
        timezone.now().timestamp() - 60,
    )

    response = api_client.post(
        '/register/auth/totp/verify/',
        {
            'email': professional.email,
            'code': skewed_code,
            'device_id': 'iphone-test-device',
        },
        format='json',
    )

    assert response.status_code == 200, response.content
    data = response.json()
    assert 'access' in data
    assert data['device_id'] == 'iphone-test-device'
