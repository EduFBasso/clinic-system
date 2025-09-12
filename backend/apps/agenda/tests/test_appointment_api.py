import pytest
from django.utils import timezone
from rest_framework.test import APIClient
from apps.register.models import Professional, Client


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def professional(db):
    return Professional.objects.create_user(
        email='agendaapi@example.com', password='secret123', first_name='Agenda', last_name='API'
    )


@pytest.fixture
def auth_client(api_client, professional):
    # Obtem token JWT e seta Authorization header
    r = api_client.post('/token/', {'email': professional.email, 'password': 'secret123'}, format='json')
    access = r.json()['access']
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
    return api_client


@pytest.fixture
def client_obj(db, professional):
    return Client.objects.create(
        professional=professional,
        first_name='Cliente',
        last_name='API',
        phone='11988887777'
    )


@pytest.mark.django_db
def test_cannot_create_past_appointment(auth_client, client_obj):
    past_start = timezone.now() - timezone.timedelta(hours=2)
    payload = {
        'client': client_obj.id,
        'title': 'Consulta Passada',
        'visit_type': 'avaliacao',
        'start_at': past_start.isoformat(),
        'end_at': (past_start + timezone.timedelta(hours=1)).isoformat(),
    }
    r = auth_client.post('/agenda/appointments/', payload, format='json')
    assert r.status_code in (400, 422), r.content
    data = r.json()
    # Converte para lista/str conforme formato DRF: {field: ["msg"]} ou {field: "msg"}
    start_errors = data.get('start_at')
    if isinstance(start_errors, list):
        joined = ' '.join(start_errors)
    else:
        joined = str(start_errors)
    assert 'passado' in joined.lower()


@pytest.mark.django_db
def test_create_future_and_conflict(auth_client, client_obj):
    base = (timezone.now() + timezone.timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)
    payload = {
        'client': client_obj.id,
        'title': 'Primeira',
        'visit_type': 'avaliacao',
        'start_at': base.isoformat(),
        'end_at': (base + timezone.timedelta(minutes=30)).isoformat(),
    }
    r1 = auth_client.post('/agenda/appointments/', payload, format='json')
    assert r1.status_code == 201, r1.content

    # Tentar conflito parcial sobrepondo dentro do período existente
    conflict_payload = {
        'client': client_obj.id,
        'title': 'Conflito',
        'visit_type': 'avaliacao',
        'start_at': (base + timezone.timedelta(minutes=15)).isoformat(),
        'end_at': (base + timezone.timedelta(minutes=45)).isoformat(),
    }
    r2 = auth_client.post('/agenda/appointments/', conflict_payload, format='json')
    # Conflito gera 400 ValidationError
    assert r2.status_code in (400, 409), r2.content
    body = r2.json()
    # Mensagem geral ou detail
    combined = ' '.join(str(v) for v in body.values())
    assert 'conflit' in combined.lower()
