# backend\apps\register\tests\test_auth.py
# teste de login com JWT token simples
def test_login_token_sucesso(api_client, profissional):
    response = api_client.post("/token/", {
        "email": profissional.email,
        "password": "123456"
    })
    assert response.status_code == 200
    assert "access" in response.data
    

def test_login_admin_token(admin_client):
    response = admin_client.get("/register/clients/")  # só pra ver se o token funciona
    assert response.status_code in [200, 403]  # depende da permissão aplicada à rota

    
def test_admin_cadastra_profissional(admin_client):
    payload = {
        "first_name": "Lucas",
        "last_name": "Pereira",
        "email": "lucas@clinica.com",
        "password": "Senha123!",
        "register_number": "REG456"
    }
    response = admin_client.post("/register/professionals/", payload)
    print("Resposta:", response.data)
    assert response.status_code == 201


from apps.register.models import Professional

def test_login_profissional_lucas(client, db):
    Professional.objects.create_user(
        email="lucas@clinica.com",
        password="Senha123!",
        first_name="Lucas",
        last_name="Pereira",
        register_number="REG456"
    )

    response = client.post("/token/", {
        "email": "lucas@clinica.com",
        "password": "Senha123!"
    })

    print("Resposta:", response.data)
    assert response.status_code == 200
    assert "access" in response.data


"""
📘 Módulo: test_auth.py

Testa autenticação via JWT e criação de profissionais.

- Verifica resposta com token válido
- Valida ações com usuário admin autenticado
- Garante fluxo completo de login para novos profissionais
"""