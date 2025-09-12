import pytest
from django.utils import timezone
from rest_framework.test import APIClient
from apps.register.models import Professional, Client
from apps.agenda.models import Appointment

pytestmark = pytest.mark.django_db


@pytest.fixture
def professional():
    return Professional.objects.create_user(
        email='rules@example.com', password='x', first_name='Regra', last_name='Test'
    )


@pytest.fixture
def api(professional):
    c = APIClient()
    c.force_authenticate(user=professional)
    return c


@pytest.fixture
def client_obj(professional):
    return Client.objects.create(
        professional=professional,
        first_name='Cliente', last_name='Regras', phone='11981110000'
    )


def make(professional, client, delta_hours_start: int, duration_min=60, status=Appointment.Status.SCHEDULED, title='Sessão'):
    start = (timezone.now() + timezone.timedelta(hours=delta_hours_start)).replace(second=0, microsecond=0)
    end = start + timezone.timedelta(minutes=duration_min)
    return Appointment.objects.create(
        professional=professional,
        client=client,
        title=title,
        start_at=start,
        end_at=end,
        status=status,
    )


def test_past_appointment_cannot_be_edited(api, professional, client_obj):
    past = make(professional, client_obj, -5)
    # tentativa de edição (PATCH) deve falhar (400 ou 403 dependendo da lógica futura)
    r = api.patch(f'/agenda/appointments/{past.id}/', {
        'notes': 'Alterando algo'
    }, format='json')
    # Caso ainda não exista validação explícita, documentamos o esperado: bloquear
    assert r.status_code in (400, 403, 422), r.content


def test_cancel_keeps_record_and_frees_slot(api, professional, client_obj):
    fut = make(professional, client_obj, 2)
    cancel = api.post(f'/agenda/appointments/{fut.id}/cancel/')
    assert cancel.status_code == 200
    # Registro continua existindo
    get_after = api.get(f'/agenda/appointments/{fut.id}/')
    assert get_after.status_code == 200
    assert get_after.json()['status'] == 'canceled'
    # Criar novo no mesmo horário deve ser possível
    new_payload = {
        'client': client_obj.id,
        'title': 'Novo',
        'visit_type': 'avaliacao',
        'start_at': fut.start_at.isoformat(),
        'end_at': fut.end_at.isoformat(),
    }
    r2 = api.post('/agenda/appointments/', new_payload, format='json')
    assert r2.status_code == 201, r2.content


def test_past_and_canceled_not_in_client_basic_next(api, professional, client_obj):
    # passado (scheduled) - deve ser ignorado
    make(professional, client_obj, -3, title='Passado')
    # futuro cancelado - não deve aparecer
    canceled_future = make(professional, client_obj, 5, title='Cancel Futuro')
    canceled_future.status = Appointment.Status.CANCELED
    canceled_future.save(update_fields=['status'])
    # futuro válido - deve ser o escolhido
    future_valid = make(professional, client_obj, 2, title='Futuro OK')
    r = api.get('/register/clients-basic/')
    assert r.status_code == 200
    row = r.json()[0]
    assert row['next_appointment_title'] == 'Futuro OK'
    assert row['next_appointment_id'] == future_valid.id
    # Garantir que não escolheu o cancelado
    assert row['next_appointment_id'] != canceled_future.id
