import pytest
from django.urls import reverse


def test_health_liveness(client):
    r = client.get('/health')
    assert r.status_code == 200
    assert r.json()['status'] == 'ok'


def test_health_full_ok(client):
    r = client.get('/health/full')
    assert r.status_code == 200
    body = r.json()
    assert 'status' in body and 'database' in body and 'version' in body and 'time' in body


def test_health_full_degraded(monkeypatch, client):
    from django.db import connection
    def fail():
        raise Exception('db down')
    monkeypatch.setattr(connection, 'ensure_connection', fail)
    r = client.get('/health/full')
    assert r.status_code == 200
    body = r.json()
    assert body['status'] == 'degraded'
    assert body['database'] == 'error'