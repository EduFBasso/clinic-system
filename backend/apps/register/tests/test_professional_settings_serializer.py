import pytest
from apps.register.serializers import ProfessionalSettingsSerializer
from apps.register.models import Professional, ProfessionalSettings


@pytest.fixture
def professional(db):
    return Professional.objects.create_user(
        email='settings@example.com', password='x', first_name='Set', last_name='Owner'
    )


def test_valid_settings(db, professional):
    ser = ProfessionalSettingsSerializer(data={
        'work_start_hour': 8,
        'work_end_hour': 18,
        'slot_minutes': 30,
        'confirm_message_enabled': False,
        'confirm_message_template': ''
    })
    assert ser.is_valid(), ser.errors
    obj = ser.save(professional=professional)
    assert obj.work_start_hour == 8


def test_invalid_interval(db, professional):
    ser = ProfessionalSettingsSerializer(data={
        'work_start_hour': 10,
        'work_end_hour': 9,
        'slot_minutes': 30,
    })
    assert not ser.is_valid()
    assert 'non_field_errors' in ser.errors


def test_invalid_slot_minutes(db, professional):
    ser = ProfessionalSettingsSerializer(data={
        'work_start_hour': 8,
        'work_end_hour': 18,
        'slot_minutes': 17,
    })
    assert not ser.is_valid()
    assert 'slot_minutes' in ser.errors