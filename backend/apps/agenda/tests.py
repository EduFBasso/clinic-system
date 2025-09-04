import datetime as dt
from django.utils import timezone
import pytest
from rest_framework.test import APIClient

from apps.register.models import Professional, Client
from .models import Appointment


pytestmark = pytest.mark.django_db


def make_professional(email="pro@example.com"):
    return Professional.objects.create_user(
        email=email, password="pass", first_name="Pro", last_name="One"
    )


def make_client(pro: Professional, i: int = 1):
    return Client.objects.create(
        professional=pro,
        first_name=f"Cli{i}",
        last_name="Test",
        phone=f"+55119{i}000000",
    )


def auth_client(user: Professional) -> APIClient:
    client = APIClient()
    # Bypass JWT for unit tests: force authenticate
    client.force_authenticate(user=user)
    return client


def test_create_appointment_and_list():
    pro = make_professional()
    cli = make_client(pro)
    c = auth_client(pro)

    start = timezone.now() + dt.timedelta(hours=1)
    end = start + dt.timedelta(minutes=30)
    payload = {
        "professional": pro.id,
        "client": cli.id,
        "title": "Avaliação inicial",
        "visit_type": "avaliacao",
        "start_at": start.isoformat(),
        "end_at": end.isoformat(),
    }
    res = c.post("/agenda/appointments/", payload, format="json")
    assert res.status_code == 201, res.data
    data = res.json()
    assert data["title"] == "Avaliação inicial"

    # list should return one item
    res2 = c.get("/agenda/appointments/?start=" + (start - dt.timedelta(days=1)).isoformat())
    assert res2.status_code == 200
    assert len(res2.json()) == 1


def test_overlap_is_blocked():
    pro = make_professional("pro2@example.com")
    cli = make_client(pro, 2)
    c = auth_client(pro)

    base = timezone.now() + dt.timedelta(hours=2)
    a1 = Appointment.objects.create(
        professional=pro,
        client=cli,
        title="Sessão 1",
        visit_type=Appointment.VisitType.AVALIACAO,
        start_at=base,
        end_at=base + dt.timedelta(minutes=30),
    )

    payload = {
        "professional": pro.id,
        "client": cli.id,
        "title": "Sessão 2",
        "visit_type": "retorno",
        "start_at": (base + dt.timedelta(minutes=15)).isoformat(),
        "end_at": (base + dt.timedelta(minutes=45)).isoformat(),
    }
    res = c.post("/agenda/appointments/", payload, format="json")
    assert res.status_code == 400
    assert "Conflito" in str(res.data)


def test_multiple_same_day_allowed_if_no_overlap():
    pro = make_professional("pro3@example.com")
    cli = make_client(pro, 3)
    c = auth_client(pro)

    base = timezone.now().replace(hour=9, minute=0, second=0, microsecond=0)
    # Primeiro agendamento no dia
    res1 = c.post(
        "/agenda/appointments/",
        {
            "professional": pro.id,
            "client": cli.id,
            "title": "Sessão manhã",
            "visit_type": "avaliacao",
            "start_at": base.isoformat(),
            "end_at": (base + dt.timedelta(minutes=30)).isoformat(),
        },
        format="json",
    )
    assert res1.status_code == 201, res1.data

    # Segundo no mesmo dia, horário diferente (sem sobreposição), deve passar
    res2 = c.post(
        "/agenda/appointments/",
        {
            "professional": pro.id,
            "client": cli.id,
            "title": "Sessão tarde",
            "visit_type": "retorno",
        "start_at": (base.replace(hour=10)).isoformat(),
        "end_at": (base.replace(hour=10) + dt.timedelta(minutes=30)).isoformat(),
        },
        format="json",
    )
    assert res2.status_code == 201, res2.data
