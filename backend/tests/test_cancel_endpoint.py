import pytest
from django.utils import timezone
from apps.agenda.models import Appointment
from apps.register.models import Client


@pytest.mark.django_db
def test_cancel_sets_canceled_at(client, django_user_model):
    pro = django_user_model.objects.create_user(email='pc@example.com', password='x', first_name='PC', last_name='X')
    client.force_login(pro)
    c = Client.objects.create(professional=pro, first_name='CC', last_name='LL')
    now = timezone.now()
    appt = Appointment.objects.create(
        professional=pro,
        client=c,
        title='Sessão',
        start_at=now - timezone.timedelta(minutes=30),
        end_at=now + timezone.timedelta(minutes=30),
        status=Appointment.Status.SCHEDULED,
    )
    r = client.post(f'/agenda/appointments/{appt.id}/cancel/')
    assert r.status_code == 200
    appt.refresh_from_db()
    assert appt.status == Appointment.Status.CANCELED
    assert appt.canceled_at is not None


@pytest.mark.django_db
def test_cancel_idempotent(client, django_user_model):
    pro = django_user_model.objects.create_user(email='pc2@example.com', password='x', first_name='PC2', last_name='X2')
    client.force_login(pro)
    c = Client.objects.create(professional=pro, first_name='CC2', last_name='LL2')
    now = timezone.now()
    appt = Appointment.objects.create(
        professional=pro,
        client=c,
        title='Sessão',
        start_at=now - timezone.timedelta(minutes=10),
        end_at=now + timezone.timedelta(minutes=20),
        status=Appointment.Status.SCHEDULED,
    )
    r1 = client.post(f'/agenda/appointments/{appt.id}/cancel/')
    assert r1.status_code == 200
    appt.refresh_from_db()
    first_canceled_at = appt.canceled_at
    assert first_canceled_at is not None
    r2 = client.post(f'/agenda/appointments/{appt.id}/cancel/')
    assert r2.status_code == 200
    appt.refresh_from_db()
    assert appt.canceled_at == first_canceled_at  # não deve mudar


@pytest.mark.django_db
def test_finalize_sets_finalized_at_once(client, django_user_model):
    pro = django_user_model.objects.create_user(email='pf@example.com', password='x', first_name='PF', last_name='X')
    client.force_login(pro)
    c = Client.objects.create(professional=pro, first_name='CF', last_name='LF')
    now = timezone.now()
    appt = Appointment.objects.create(
        professional=pro,
        client=c,
        title='Consulta',
        start_at=now - timezone.timedelta(minutes=5),
        end_at=now + timezone.timedelta(minutes=25),
        status=Appointment.Status.SCHEDULED,
    )
    r1 = client.post(f'/agenda/appointments/{appt.id}/finalize/')
    assert r1.status_code == 200
    appt.refresh_from_db()
    first_finalized = appt.finalized_at
    assert first_finalized is not None
    # Segunda chamada (idempotente) não altera timestamp
    r2 = client.post(f'/agenda/appointments/{appt.id}/finalize/')
    assert r2.status_code == 200
    appt.refresh_from_db()
    assert appt.finalized_at == first_finalized
