import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.agenda.models import Charge, ClinicalRecord, Encounter
from apps.clients.models import Client
from apps.inventory.models import Product, Service
from apps.register.models import Professional


pytestmark = pytest.mark.django_db


@pytest.fixture
def professional():
    return Professional.objects.create_user(
        email="sprint1@example.com",
        password="secret123",
        first_name="Sprint",
        last_name="One",
    )


@pytest.fixture
def other_professional():
    return Professional.objects.create_user(
        email="other-sprint1@example.com",
        password="secret123",
        first_name="Other",
        last_name="Professional",
    )


@pytest.fixture
def auth_client(professional):
    client = APIClient()
    client.force_authenticate(user=professional)
    return client


@pytest.fixture
def client_obj(professional):
    return Client.objects.create(
        professional=professional,
        first_name="Cliente",
        last_name="Sprint",
        phone="11999998888",
    )


@pytest.fixture
def other_client(other_professional):
    return Client.objects.create(
        professional=other_professional,
        first_name="Outro",
        last_name="Cliente",
        phone="11999997777",
    )


@pytest.fixture
def service(professional):
    return Service.objects.create(
        professional=professional,
        name="Avaliação biomecânica",
        base_price="120.00",
    )


@pytest.fixture
def product(professional):
    return Product.objects.create(
        professional=professional,
        name="Palmilha",
        price="80.00",
        cost="35.00",
    )


def test_create_independent_encounter(auth_client, client_obj):
    response = auth_client.post(
        "/agenda/encounters/",
        {
            "client": client_obj.id,
            "chief_complaint": "Dor plantar há 2 semanas",
            "assessment": "Paciente refere piora ao caminhar.",
            "plan": "Realizar avaliação e orientar descarga.",
            "notes": "Chegou sem agendamento.",
            "status": "open",
        },
        format="json",
    )

    assert response.status_code == 201, response.content
    data = response.json()
    assert data["appointment"] is None
    assert data["status"] == "open"


def test_only_one_open_encounter_per_client(auth_client, client_obj):
    Encounter.objects.create(
        professional=client_obj.professional,
        client=client_obj,
        chief_complaint="Dor",
        status=Encounter.Status.OPEN,
    )

    response = auth_client.post(
        "/agenda/encounters/",
        {
            "client": client_obj.id,
            "chief_complaint": "Nova avaliação",
            "status": "open",
        },
        format="json",
    )

    assert response.status_code == 400, response.content
    assert "atendimento em andamento" in str(response.json()).lower()


def test_clinical_record_requires_matching_encounter(auth_client, client_obj, other_client):
    encounter = Encounter.objects.create(
        professional=other_client.professional,
        client=other_client,
        chief_complaint="Outro caso",
        status=Encounter.Status.OPEN,
    )

    response = auth_client.post(
        "/agenda/clinical-records/",
        {
            "client": client_obj.id,
            "encounter": encounter.id,
            "record_type": "evolution",
            "title": "Primeira evolução",
            "content": "Paciente evolui bem.",
        },
        format="json",
    )

    assert response.status_code == 400, response.content
    assert "mesmo cliente" in str(response.json()).lower() or "mesmo profissional" in str(response.json()).lower()


def test_create_charge_with_items_recalculates_total(auth_client, client_obj, service, product):
    response = auth_client.post(
        "/agenda/charges/",
        {
            "client": client_obj.id,
            "charge_type": "charge",
            "status": "draft",
            "title": "Cobrança do atendimento",
            "recipient_name": "Cliente Sprint",
            "recipient_phone": "11999998888",
            "items": [
                {
                    "item_type": "service",
                    "service": service.id,
                    "quantity": "1.00",
                    "unit_price": "120.00",
                    "sort_order": 0,
                },
                {
                    "item_type": "product",
                    "product": product.id,
                    "quantity": "2.00",
                    "unit_price": "80.00",
                    "sort_order": 1,
                },
                {
                    "item_type": "custom",
                    "description": "Deslocamento",
                    "quantity": "1.00",
                    "unit_price": "20.00",
                    "sort_order": 2,
                },
            ],
        },
        format="json",
    )

    assert response.status_code == 201, response.content
    data = response.json()
    assert data["total_amount"] == "300.00"
    assert len(data["items"]) == 3


def test_charge_mark_paid_sets_paid_at(auth_client, client_obj):
    charge = Charge.objects.create(
        professional=client_obj.professional,
        client=client_obj,
        charge_type=Charge.ChargeType.CHARGE,
        status=Charge.Status.DRAFT,
        title="Cobrança simples",
    )
    charge.items.create(
        item_type="custom",
        description="Consulta",
        quantity="1.00",
        unit_price="100.00",
    )

    response = auth_client.post(f"/agenda/charges/{charge.id}/mark-paid/", format="json")

    assert response.status_code == 200, response.content
    data = response.json()
    assert data["status"] == "paid"
    assert data["paid_at"] is not None


def test_clinical_record_delete_is_blocked(auth_client, client_obj):
    record = ClinicalRecord.objects.create(
        professional=client_obj.professional,
        client=client_obj,
        record_type=ClinicalRecord.RecordType.NOTE,
        title="Nota",
        content="Histórico preservado.",
        recorded_at=timezone.now(),
    )

    response = auth_client.delete(f"/agenda/clinical-records/{record.id}/")

    assert response.status_code == 405