import pytest
from apps.clients.serializers import _normalize_uf, _normalize_cep

@pytest.mark.parametrize("raw,expected", [
    ("sp", "SP"),
    ("Sp", "SP"),
    ("São Paulo", "SP"),
    ("sao paulo", "SP"),
    (" rj ", "RJ"),
    ("Rio de Janeiro", "RJ"),
    ("ceara", "CE"),
    ("  Ce ", "CE"),
])
def test_normalize_uf_valid(raw, expected):
    assert _normalize_uf(raw) == expected

@pytest.mark.parametrize("raw", ["", None])
def test_normalize_uf_empty(raw):
    assert _normalize_uf(raw) == ""

@pytest.mark.parametrize("raw", ["XX", "estadox", "123", "brasil"])
def test_normalize_uf_invalid(raw):
    from rest_framework import serializers
    with pytest.raises(serializers.ValidationError):
        _normalize_uf(raw)

def test_normalize_cep_valid():
    assert _normalize_cep("13480-460") == "13480460"
    assert _normalize_cep("13480460") == "13480460"

@pytest.mark.parametrize("raw", ["", None])
def test_normalize_cep_empty(raw):
    assert _normalize_cep(raw) == ""

@pytest.mark.parametrize("raw", ["123", "ABCDE123", "9999999", "123456789"])  # len != 8
def test_normalize_cep_invalid(raw):
    from rest_framework import serializers
    with pytest.raises(serializers.ValidationError):
        _normalize_cep(raw)
