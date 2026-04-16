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
        'work_start_minute': 30,
        'work_end_hour': 18,
        'work_end_minute': 15,
        'slot_minutes': 30,
        'default_duration_minutes': 90,
        'default_visit_type': 'retorno',
        'confirm_message_enabled': False,
        'confirm_message_template': ''
    })
    assert ser.is_valid(), ser.errors
    obj = ser.save(professional=professional)
    assert obj.work_start_hour == 8
    assert obj.work_start_minute == 30
    assert obj.work_end_minute == 15
    assert obj.default_duration_minutes == 90
    assert obj.default_visit_type == 'retorno'


def test_invalid_interval(db, professional):
    ser = ProfessionalSettingsSerializer(data={
        'work_start_hour': 10,
        'work_start_minute': 30,
        'work_end_hour': 9,
        'work_end_minute': 45,
        'slot_minutes': 30,
        'default_duration_minutes': 60,
        'default_visit_type': 'consulta',
    })
    assert not ser.is_valid()
    assert 'non_field_errors' in ser.errors


def test_invalid_slot_minutes(db, professional):
    ser = ProfessionalSettingsSerializer(data={
        'work_start_hour': 8,
        'work_start_minute': 0,
        'work_end_hour': 18,
        'work_end_minute': 0,
        'slot_minutes': 17,
        'default_duration_minutes': 60,
        'default_visit_type': 'consulta',
    })
    assert not ser.is_valid()
    assert 'slot_minutes' in ser.errors


def test_invalid_end_minute_when_hour_is_24(db, professional):
    ser = ProfessionalSettingsSerializer(data={
        'work_start_hour': 8,
        'work_start_minute': 0,
        'work_end_hour': 24,
        'work_end_minute': 15,
        'slot_minutes': 30,
        'default_duration_minutes': 60,
        'default_visit_type': 'consulta',
    })
    assert not ser.is_valid()
    assert 'work_end_minute' in ser.errors


def test_invalid_default_duration(db, professional):
    ser = ProfessionalSettingsSerializer(data={
        'work_start_hour': 8,
        'work_start_minute': 0,
        'work_end_hour': 18,
        'work_end_minute': 0,
        'slot_minutes': 30,
        'default_duration_minutes': 40,
        'default_visit_type': 'consulta',
    })
    assert not ser.is_valid()
    assert 'default_duration_minutes' in ser.errors


def test_invalid_default_visit_type(db, professional):
    ser = ProfessionalSettingsSerializer(data={
        'work_start_hour': 8,
        'work_start_minute': 0,
        'work_end_hour': 18,
        'work_end_minute': 0,
        'slot_minutes': 30,
        'default_duration_minutes': 60,
        'default_visit_type': 'primeira_consulta',
    })
    assert not ser.is_valid()
    assert 'default_visit_type' in ser.errors