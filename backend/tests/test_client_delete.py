from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.agenda.models import Appointment, Charge, ClinicalRecord, Encounter, FinalizeAudit
from apps.anamnesis.models import AnamnesisField, AnamnesisResponse
from apps.clients.models import Client
from apps.register.models import Professional


pytestmark = pytest.mark.django_db


@pytest.fixture
def professional():
    return Professional.objects.create_user(
        email='delete-owner@example.com',
        password='secret123',
        first_name='Owner',
        last_name='Tester',
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
        first_name='Cliente',
        last_name='Excluir',
        phone='11999999991',
    )


def test_delete_client_cascades_related_records(auth_client, professional, client_obj):
    start_at = timezone.now() + timedelta(hours=1)
    appointment = Appointment.objects.create(
        professional=professional,
        client=client_obj,
        title='Consulta ativa',
        start_at=start_at,
        end_at=start_at + timedelta(hours=1),
    )
    FinalizeAudit.objects.create(
        appointment=appointment,
        professional=professional,
        client=client_obj,
        server_now=timezone.now(),
    )
    encounter = Encounter.objects.create(
        professional=professional,
        client=client_obj,
        appointment=appointment,
        notes='Atendimento em aberto',
    )
    ClinicalRecord.objects.create(
        professional=professional,
        client=client_obj,
        encounter=encounter,
        content='Registro clínico',
    )
    Charge.objects.create(
        professional=professional,
        client=client_obj,
        encounter=encounter,
        appointment=appointment,
        title='Cobrança teste',
    )
    field = AnamnesisField.objects.create(
        professional=professional,
        code='takes_medication',
        sector='Histórico',
        sector_order=0,
        label='Toma medicação',
        field_type='radio',
        options=['Sim', 'Não'],
        order=0,
    )
    AnamnesisResponse.objects.create(
        client=client_obj,
        field=field,
        field_label_snap='Toma medicação',
        value='Sim',
    )

    response = auth_client.delete(f'/register/clients/{client_obj.id}/')

    assert response.status_code == 204, response.content
    assert not Client.objects.filter(pk=client_obj.id).exists()
    assert not Appointment.objects.filter(client_id=client_obj.id).exists()
    assert not FinalizeAudit.objects.filter(client_id=client_obj.id).exists()
    assert not Encounter.objects.filter(client_id=client_obj.id).exists()
    assert not ClinicalRecord.objects.filter(client_id=client_obj.id).exists()
    assert not Charge.objects.filter(client_id=client_obj.id).exists()
    assert not AnamnesisResponse.objects.filter(client_id=client_obj.id).exists()


def test_clients_basic_detail_is_read_only(auth_client, client_obj):
    response = auth_client.delete(f'/register/clients-basic/{client_obj.id}/')

    assert response.status_code == 405, response.content
    assert Client.objects.filter(pk=client_obj.id).exists()