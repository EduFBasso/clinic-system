import pytest
from django.utils import timezone
from rest_framework.test import APIClient
from apps.register.models import Professional, Client
from apps.agenda.models import Appointment


pytestmark = pytest.mark.django_db


@pytest.fixture
def professional():
    return Professional.objects.create_user(
        email="nextappt@example.com", password="x", first_name="Next", last_name="Appt"
    )


@pytest.fixture
def api(professional):
    c = APIClient()
    # autentica via force para simplificar (já que testamos apenas lógica interna)
    c.force_authenticate(user=professional)
    return c


@pytest.fixture
def client_a(professional):
    return Client.objects.create(
        professional=professional,
        first_name="Ana",
        last_name="Teste",
        phone="11960000001",
    )


def make_appt(professional, client, start_offset_hours: int, duration_min=60, title="Sessão"):
    start = (timezone.now() + timezone.timedelta(hours=start_offset_hours)).replace(second=0, microsecond=0)
    end = start + timezone.timedelta(minutes=duration_min)
    return Appointment.objects.create(
        professional=professional,
        client=client,
        title=title,
        start_at=start,
        end_at=end,
        status=Appointment.Status.SCHEDULED,
    )


def test_client_basic_next_appointment_fields(api, professional, client_a):
    # Dois compromissos futuros; o mais cedo deve ser anotado
    later = make_appt(professional, client_a, 6, title="Mais tarde")
    earlier = make_appt(professional, client_a, 3, title="Mais cedo")

    r = api.get('/register/clients-basic/')
    assert r.status_code == 200, r.content
    data = r.json()
    assert len(data) == 1
    row = data[0]
    # Deve apontar para o appointment 'Mais cedo'
    assert row['next_appointment_title'] == 'Mais cedo'
    assert row['next_appointment_id'] == earlier.id
    # Checagem de consistência start/end
    assert row['next_appointment_start_at'][:16] == earlier.start_at.isoformat()[:16]
    assert row['next_appointment_end_at'][:16] == earlier.end_at.isoformat()[:16]


def test_client_basic_switch_when_earliest_canceled(api, professional, client_a):
    a1 = make_appt(professional, client_a, 2, title="Primeiro")
    a2 = make_appt(professional, client_a, 4, title="Segundo")
    # Cancelar o primeiro
    a1.status = Appointment.Status.CANCELED
    a1.save(update_fields=["status"])
    r = api.get('/register/clients-basic/')
    assert r.status_code == 200
    row = r.json()[0]
    assert row['next_appointment_title'] == 'Segundo'
    assert row['next_appointment_id'] == a2.id


def test_client_basic_next_appointment_not_past(api, professional, client_a):
    # Um passado + um futuro: deve ignorar passado
    past = make_appt(professional, client_a, -5, title="Passado")
    future = make_appt(professional, client_a, 1, title="Futuro")
    r = api.get('/register/clients-basic/')
    row = r.json()[0]
    assert row['next_appointment_title'] == 'Futuro'
    assert row['next_appointment_id'] == future.id
    assert past.id != row['next_appointment_id']


def test_client_basic_no_future_returns_nulls(api, professional, client_a):
    # Nenhum futuro => campos nulos/ausentes
    make_appt(professional, client_a, -2, title="Passado")
    r = api.get('/register/clients-basic/')
    row = r.json()[0]
    assert row['next_appointment_id'] is None or row['next_appointment_id'] == None  # explicit
    assert row['next_appointment_start_at'] is None


def test_time_zone_consistency(api, professional, client_a, settings):
    # Garantir que USE_TZ True e TIME_ZONE definido não gera deslocamento duplo
    assert settings.USE_TZ is True
    appt = make_appt(professional, client_a, 2)
    r = api.get('/register/clients-basic/')
    row = r.json()[0]
    # A comparação até minuto evita falsos negativos por formatação de segundos
    assert row['next_appointment_start_at'][:16] == appt.start_at.isoformat()[:16]
