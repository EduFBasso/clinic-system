# backend/apps/register/tests/test_professionals.py

from apps.register.models import Professional

# 🧪 Teste 04 – Lista básica de profissionais via rota pública
# ▶️ pytest apps/register/tests/test_professionals.py::test_04_lista_profissionais_basicos -s

def test_04_lista_profissionais_basicos(client, db):
    Professional.objects.create_user(
        email="ana@clinica.com", password="123",
        first_name="Ana", last_name="Silva", register_number="CRM101"
    )
    Professional.objects.create_user(
        email="joao@clinica.com", password="123",
        first_name="João", last_name="Souza", register_number="CRM202"
    )

    response = client.get("/register/professionals-basic/")
    print("Resposta:", response.data)

    assert response.status_code == 200
    assert isinstance(response.data, list)
    assert len(response.data) == 2
    assert all("first_name" in prof for prof in response.data)

"""
📘 Módulo: test_professionals.py

Testa a listagem pública e enxuta dos profissionais disponíveis.

- Endpoint: /register/professionals-basic/
- Retorna dados mínimos: id, nome, registro profissional
- Ideal para menus de vínculo ou autocomplete no frontend
"""