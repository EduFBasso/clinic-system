import pytest
from rest_framework.test import APIClient

@pytest.mark.django_db
def test_version_header_present():
    c = APIClient()
    r = c.get('/health/')
    assert r.status_code == 200  # type: ignore[union-attr]
    assert 'X-App-Version' in r.headers
    assert r.headers['X-App-Version']  # non-empty
