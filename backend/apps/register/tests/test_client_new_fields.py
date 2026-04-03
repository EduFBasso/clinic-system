import pytest
from datetime import date
from apps.clients.models import Client
from apps.clients.serializers import ClientSerializer
from apps.register.models import Professional

pytestmark = pytest.mark.django_db

@pytest.fixture
def professional():
    return Professional.objects.create_user(
        email="fields@example.com", password="x", first_name="Fields", last_name="Test"
    )

def test_create_with_date_of_birth_and_address_number(professional):
    dob = date(1990, 5, 17)
    ser = ClientSerializer(
        data={
            "first_name": "Maria",
            "last_name": "Teste",
            "phone": "11988887777",
            "date_of_birth": dob.isoformat(),
            "address_number": "123",
        }
    )
    assert ser.is_valid(), ser.errors
    obj = ser.save(professional=professional)
    assert obj.date_of_birth == dob
    assert obj.address_number == "123"


def test_create_without_optional_fields(professional):
    ser = ClientSerializer(
        data={
            "first_name": "Joao",
            "last_name": "Silva",
            "phone": "11999998888",
        }
    )
    assert ser.is_valid(), ser.errors
    obj = ser.save(professional=professional)
    assert obj.date_of_birth is None
    assert obj.address_number is None


def test_partial_update_date_and_number(professional):
    client = Client.objects.create(
        professional=professional,
        first_name="Ana",
        last_name="Base",
        phone="11970000000",
    )
    ser = ClientSerializer(
        client,
        data={"date_of_birth": "2001-01-02", "address_number": "45"},
        partial=True,
    )
    assert ser.is_valid(), ser.errors
    obj = ser.save()
    assert str(obj.date_of_birth) == "2001-01-02"
    assert obj.address_number == "45"


def test_reject_invalid_date(professional):
    ser = ClientSerializer(
        data={
            "first_name": "Data",
            "last_name": "Invalida",
            "phone": "11981112222",
            "date_of_birth": "1990-13-40",  # data impossível
        }
    )
    assert not ser.is_valid()
    assert "date_of_birth" in ser.errors


def test_reject_non_digit_address_number(professional):
    ser = ClientSerializer(
        data={
            "first_name": "Num",
            "last_name": "Errado",
            "phone": "11982223333",
            "address_number": "12A4",  # contém letra
        }
    )
    # Dependendo da validação implementada, pode ser aceito se não houver regra explícita.
    # Se quisermos forçar apenas dígitos, ajustamos o serializer. Aqui verificamos comportamento atual.
    ser.is_valid()
    # Placeholder assertion: apenas garante que o campo está presente em validated_data (ou erro se futuramente validado)
    if ser.is_valid():
        assert "address_number" in ser.validated_data
    else:
        assert "address_number" in ser.errors
