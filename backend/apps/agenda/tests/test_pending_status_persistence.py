import pytest
from django.utils import timezone

from apps.agenda.models import Appointment
from apps.clients.models import Client
from apps.register.models import Professional


@pytest.fixture
def professional(db):
    return Professional.objects.create_user(
        email="pending-status@example.com",
        password="secret123",
        first_name="Pending",
        last_name="Status",
    )


@pytest.fixture
def client_obj(db, professional):
    return Client.objects.create(
        professional=professional,
        first_name="Cliente",
        last_name="Pending",
        phone="11999998888",
    )


@pytest.mark.django_db
def test_appointment_can_persist_pending_status(professional, client_obj):
    base = (timezone.now() + timezone.timedelta(hours=1)).replace(
        second=0,
        microsecond=0,
    )

    appt = Appointment.objects.create(
        professional=professional,
        client=client_obj,
        title="Compromisso pendente",
        visit_type=Appointment.VisitType.AVALIACAO,
        start_at=base,
        end_at=base + timezone.timedelta(minutes=30),
        status=Appointment.Status.PENDING,
    )

    appt.refresh_from_db()

    assert appt.status == Appointment.Status.PENDING


@pytest.mark.django_db
def test_status_filter_accepts_pending_value(client, professional, client_obj):
    client.force_login(professional)
    base = (timezone.now() + timezone.timedelta(hours=2)).replace(
        second=0,
        microsecond=0,
    )

    Appointment.objects.create(
        professional=professional,
        client=client_obj,
        title="Compromisso pendente",
        visit_type=Appointment.VisitType.AVALIACAO,
        start_at=base,
        end_at=base + timezone.timedelta(minutes=30),
        status=Appointment.Status.PENDING,
    )
    Appointment.objects.create(
        professional=professional,
        client=client_obj,
        title="Compromisso agendado",
        visit_type=Appointment.VisitType.RETORNO,
        start_at=base + timezone.timedelta(hours=1),
        end_at=base + timezone.timedelta(hours=1, minutes=30),
        status=Appointment.Status.SCHEDULED,
    )

    response = client.get("/agenda/appointments/?status=pending")

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["status"] == Appointment.Status.PENDING