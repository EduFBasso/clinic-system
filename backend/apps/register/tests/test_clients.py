# backend\apps\register\tests\test_clients.py
from apps.register.models import Client

def test_cria_cliente(api_client):
    payload = {
        "first_name": "Carla",
        "last_name": "Rodrigues",
        "email": "carla@teste.com",
        "city": "Curitiba",
        "state": "PR"
    }

    response = api_client.post("/register/clients/", payload)

    assert response.status_code == 201
    assert Client.objects.filter(email="carla@teste.com").exists()


def test_lucas_cria_cliente(lucas_client):
    payload = {
        "first_name": "Juliana",
        "last_name": "Almeida",
        "email": "ju@teste.com",
        "city": "São Paulo",
        "state": "SP",
        "takes_medication": False,
        "had_surgery": False,
        "is_pregnant": False
    }

    response = lucas_client.post("/register/clients/", payload)
    print("Resposta:", response.data)

    assert response.status_code == 201
    assert Client.objects.filter(email="ju@teste.com").exists()


# 🧪 Teste 05 – Verifica filtro por nome nos clientes do profissional autenticado
# ▶️ pytest apps/register/tests/test_clients.py::test_filtro_por_nome -s

def test_filtro_por_nome(lucas_client, db):
    # Cria clientes variados para Lucas
    lucas_client.post("/register/clients/", {
        "first_name": "Juliana", "last_name": "Silva",
        "email": "juliana@exemplo.com", "city": "SP", "state": "SP",
        "takes_medication": False, "had_surgery": False, "is_pregnant": False
    })

    lucas_client.post("/register/clients/", {
        "first_name": "Carlos", "last_name": "Oliveira",
        "email": "carlos@exemplo.com", "city": "RJ", "state": "RJ",
        "takes_medication": False, "had_surgery": False, "is_pregnant": False
    })

    response = lucas_client.get("/register/clients/?nome=Ju")
    print("Resposta filtrada:", response.data)

    assert response.status_code == 200
    assert len(response.data) == 1
    assert response.data[0]['first_name'] == "Juliana"


# 🧪 Teste 06 – Verifica se o profissional consegue editar um cliente
# ▶️ pytest apps/register/tests/test_clients.py::test_edicao_cliente -s
def test_edicao_cliente(lucas_client, db):
    # Cria cliente
    response_create = lucas_client.post("/register/clients/", {
        "first_name": "Camila", "last_name": "Pereira",
        "email": "camila@exemplo.com", "city": "Campinas", "state": "SP",
        "takes_medication": False, "had_surgery": False, "is_pregnant": False
    })
    cliente_id = response_create.data["id"]

    # Atualiza cidade
    response_update = lucas_client.put(f"/register/clients/{cliente_id}/", {
        "first_name": "Camila", "last_name": "Pereira",
        "email": "camila@exemplo.com", "city": "Limeira", "state": "SP",
        "takes_medication": False, "had_surgery": False, "is_pregnant": False
    })

    print("Cliente atualizado:", response_update.data)
    assert response_update.status_code == 200
    assert response_update.data["city"] == "Limeira"    


    # 🧪 Teste 06 – Verifica se um cliente pode ser excluído com sucesso
# ▶️ pytest apps/register/tests/test_clients.py::test_exclusao_cliente -s
def test_exclusao_cliente(lucas_client, db):
    # Cria cliente para exclusão
    response_create = lucas_client.post("/register/clients/", {
        "first_name": "Diego",
        "last_name": "Ferraz",
        "email": "diego@exemplo.com",
        "city": "Sorocaba",
        "state": "SP",
        "takes_medication": False,
        "had_surgery": False,
        "is_pregnant": False
    })
    cliente_id = response_create.data["id"]

    # Exclui o cliente
    response_delete = lucas_client.delete(f"/register/clients/{cliente_id}/")
    assert response_delete.status_code == 204

    # Valida que ele foi removido
    response_check = lucas_client.get(f"/register/clients/{cliente_id}/")
    assert response_check.status_code == 404


# 🧪 Teste 07 – Lista dados resumidos dos clientes autenticados (rota básica)
# ▶️ pytest apps/register/tests/test_clients.py::test_listagem_basica_clientes -s
def test_listagem_basica_clientes(lucas_client, db):
    lucas_client.post("/register/clients/", {
        "first_name": "Renata",
        "last_name": "Campos",
        "phone": "(11) 99999-1234",
        "address_street": "Av. Brasil",
        "address_number": "123",
        "city": "São Paulo",
        "state": "SP",
        "email": "renata@exemplo.com",
        "takes_medication": False,
        "had_surgery": False,
        "is_pregnant": False
    })

    response = lucas_client.get("/register/clients-basic/")
    print("Resposta resumida:", response.data)

    assert response.status_code == 200
    assert len(response.data) == 1
    assert "email" not in response.data[0]
    assert "first_name" in response.data[0]
    assert "phone" in response.data[0]
    assert "address_street" in response.data[0]


# 🧪 Teste 08 – Ordena clientes por cidade em ordem alfabética
# ▶️ pytest apps/register/tests/test_clients.py::test_ordenacao_clientes_por_cidade -s

def test_ordenacao_clientes_por_cidade(lucas_client, db):
    clientes = [
        {"first_name": "Paula", "last_name": "Silva", "email": "p1@ex.com", "city": "Campinas"},
        {"first_name": "Bruno", "last_name": "Santos", "email": "p2@ex.com", "city": "Araras"},
        {"first_name": "Leandro", "last_name": "Costa", "email": "p3@ex.com", "city": "Bauru"},
    ]

    for cliente in clientes:
        lucas_client.post("/register/clients/", {
            **cliente, "state": "SP",
            "takes_medication": False,
            "had_surgery": False,
            "is_pregnant": False
        })

    response = lucas_client.get("/register/clients/?ordering=city")
    print("Ordem por cidade:", [c["city"] for c in response.data])

    cidades = [c["city"] for c in response.data]
    assert cidades == sorted(cidades)

"""
📘 Módulo: test_clients.py

Testes de CRUD, ordenação e filtragem para o modelo Client.

- Criação, edição, exclusão e listagem básica
- Filtragem por nome e ordenação por campos
- Validação da segurança via usuários autenticados
"""