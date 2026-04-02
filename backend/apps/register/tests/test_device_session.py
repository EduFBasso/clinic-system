import pytest
from django.utils import timezone
from apps.register.models import Professional, DeviceSession


@pytest.fixture
def professional(db):
    return Professional.objects.create_user(
        email="pro3@example.com", password="x", first_name="Pro", last_name="Three"
    )


def test_device_session_terminate(db, professional):
    ds = DeviceSession.objects.create(professional=professional, device_id='dev-1')
    assert ds.is_active is True
    ds.terminate('manual')
    ds.refresh_from_db()
    assert ds.is_active is False
    assert ds.termination_reason == 'manual'
    assert ds.terminated_at is not None
    assert ds.terminated_at <= timezone.now()