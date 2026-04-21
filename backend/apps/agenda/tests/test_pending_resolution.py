import pytest
from django.utils import timezone
from rest_framework.test import APIClient
from apps.clients.models import Client
from apps.register.models import Professional
from apps.agenda.models import Appointment


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def professional(db):
    return Professional.objects.create_user(
        email='pending@example.com', password='secret123', first_name='Pending', last_name='Rules'
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
        last_name='Pending',
        phone='11988887777'
    )


@pytest.mark.django_db
def test_pending_then_cancel_allows_new(auth_client, professional, client_obj):
    # Cria um agendamento passado (pendente) diretamente no ORM
    base = (timezone.now() - timezone.timedelta(hours=5)).replace(second=0, microsecond=0)
    past = Appointment.objects.create(
        professional=professional,
        client=client_obj,
        title='Pendente',
        visit_type=Appointment.VisitType.AVALIACAO,
        start_at=base,
        end_at=base + timezone.timedelta(minutes=30),
        status=Appointment.Status.SCHEDULED,
    )

    # Tentar criar novo no futuro deve BLOQUEAR
    future_base = (timezone.now() + timezone.timedelta(hours=2)).replace(minute=0, second=0, microsecond=0)
    payload = {
        'client': client_obj.id,
        'title': 'Nova Consulta',
        'visit_type': 'avaliacao',
        'start_at': future_base.isoformat(),
        'end_at': (future_base + timezone.timedelta(minutes=30)).isoformat(),
    }
    r_block = auth_client.post('/agenda/appointments/', payload, format='json')
    assert r_block.status_code in (400, 422), r_block.content

    # Cancelar o passado
    r_cancel = auth_client.post(f'/agenda/appointments/{past.id}/cancel/')
    assert r_cancel.status_code == 200
    past.refresh_from_db()
    assert past.status == Appointment.Status.CANCELED

    # Agora deve permitir criar
    r_ok = auth_client.post('/agenda/appointments/', payload, format='json')
    assert r_ok.status_code == 201, r_ok.content


@pytest.mark.django_db
def test_finalize_moves_to_pending_and_done_allows_new(auth_client, professional, client_obj):
    # Cria passado pendente
    base = (timezone.now() - timezone.timedelta(days=1)).replace(minute=0, second=0, microsecond=0)
    past = Appointment.objects.create(
        professional=professional,
        client=client_obj,
        title='Pendente 2',
        visit_type=Appointment.VisitType.AVALIACAO,
        start_at=base,
        end_at=base + timezone.timedelta(minutes=30),
        status=Appointment.Status.SCHEDULED,
    )
    # Bloqueia criação
    future_base = (timezone.now() + timezone.timedelta(hours=3)).replace(minute=0, second=0, microsecond=0)
    payload = {
        'client': client_obj.id,
        'title': 'Nova Pós Conclusão',
        'visit_type': 'avaliacao',
        'start_at': future_base.isoformat(),
        'end_at': (future_base + timezone.timedelta(minutes=30)).isoformat(),
    }
    r_block = auth_client.post('/agenda/appointments/', payload, format='json')
    assert r_block.status_code in (400, 422)

    # Finaliza o compromisso e move para pending
    r_fin = auth_client.post(f'/agenda/appointments/{past.id}/finalize/')
    assert r_fin.status_code == 200, r_fin.content
    past.refresh_from_db()
    assert past.status == Appointment.Status.PENDING

    # Enquanto estiver pending ainda deve bloquear novo agendamento
    r_still_blocked = auth_client.post('/agenda/appointments/', payload, format='json')
    assert r_still_blocked.status_code in (400, 422)

    # Resolver como done libera criação posterior
    r_done = auth_client.post(f'/agenda/appointments/{past.id}/done/')
    assert r_done.status_code == 200, r_done.content
    past.refresh_from_db()
    assert past.status == Appointment.Status.DONE

    # Agora deve permitir criar
    r_ok = auth_client.post('/agenda/appointments/', payload, format='json')
    assert r_ok.status_code == 201, r_ok.content
