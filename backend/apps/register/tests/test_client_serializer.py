import pytest
from apps.clients.serializers import ClientSerializer
from apps.clients.models import Client
from apps.register.models import Professional


@pytest.fixture
def professional(db):
    return Professional.objects.create_user(
        email="pro2@example.com", password="x", first_name="Pro", last_name="Two"
    )


def test_phone_normalization(db, professional):
    data = {
        'first_name': 'Ana',
        'last_name': 'Silva',
        'phone': '(19) 98888-7777',
    }
    ser = ClientSerializer(data=data)
    assert ser.is_valid(), ser.errors
    obj = ser.save(professional=professional)
    assert obj.phone == '19988887777'


@pytest.mark.parametrize('invalid', ['123', '999', 'abcdefghij', '123456789012'])
def test_phone_invalid_lengths(db, professional, invalid):
    data = {
        'first_name': 'João',
        'last_name': 'Teste',
        'phone': invalid,
    }
    ser = ClientSerializer(data=data)
    assert not ser.is_valid()
    assert 'phone' in ser.errors


def test_optional_fields_blank(db, professional):
    data = {
        'first_name': 'Bia',
        'last_name': 'Oliveira',
        'phone': '19977776666',
        'city': '',
        'state': '',
    }
    ser = ClientSerializer(data=data)
    assert ser.is_valid(), ser.errors
    obj = ser.save(professional=professional)
    assert obj.city == '' or obj.city is None
    assert obj.state == '' or obj.state is None