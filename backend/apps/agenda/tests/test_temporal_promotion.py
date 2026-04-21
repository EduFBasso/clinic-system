import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.agenda.models import Appointment
from apps.clients.models import Client
from apps.register.models import Professional


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def professional(db):
    return Professional.objects.create_user(  # type: ignore
        email="temporal@example.com",
        password="secret123",
        first_name="Temporal",
        last_name="Promotion",
    )


@pytest.fixture
def auth_client(api_client, professional):
    r = api_client.post(
        "/token/",
        {"email": professional.email, "password": "secret123"},
        format="json",
    )
    access = r.json()["access"]
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    return api_client


@pytest.fixture
def client_obj(db, professional):
    return Client.objects.create(
        professional=professional,
        first_name="Cliente",
        last_name="Temporal",
        phone="11900000000",
    )


@pytest.mark.django_db
def test_list_promotes_overdue_scheduled_to_pending(auth_client, client_obj):
    start = timezone.now() - timezone.timedelta(hours=2)
    appt = Appointment.objects.create(
        professional=client_obj.professional,
        client=client_obj,
        title="Expirado",
        visit_type=Appointment.VisitType.CONSULTA,
        start_at=start,
        end_at=start + timezone.timedelta(minutes=30),
        status=Appointment.Status.SCHEDULED,
    )

    r = auth_client.get(
        "/agenda/appointments/",
        {"status": Appointment.Status.PENDING},
    )

    assert r.status_code == 200, r.content
    appt.refresh_from_db()
    assert appt.status == Appointment.Status.PENDING
    ids = [item["id"] for item in r.json()]
    assert appt.id in ids


@pytest.mark.django_db
def test_create_triggers_promotion_before_pending_block(auth_client, client_obj):
    start = timezone.now() - timezone.timedelta(hours=3)
    legacy = Appointment.objects.create(
        professional=client_obj.professional,
        client=client_obj,
        title="Legado vencido",
        visit_type=Appointment.VisitType.AVALIACAO,
        start_at=start,
        end_at=start + timezone.timedelta(minutes=30),
        status=Appointment.Status.SCHEDULED,
    )

    future_start = timezone.now() + timezone.timedelta(hours=2)
    payload = {
        "client": client_obj.id,
        "title": "Novo compromisso",
        "visit_type": "consulta",
        "start_at": future_start.isoformat(),
        "end_at": (future_start + timezone.timedelta(minutes=30)).isoformat(),
    }

    r = auth_client.post("/agenda/appointments/", payload, format="json")

    assert r.status_code in (400, 422), r.content
    legacy.refresh_from_db()
    assert legacy.status == Appointment.Status.PENDING
