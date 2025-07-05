▶️ Executando todos os testes
Basta rodar, na raiz do projeto:
pytest


Para exibir os print() dentro dos testes (útil pra debug):
pytest -s


Para ignorar avisos:
pytest --disable-warnings



🧪 Rodando testes por arquivo
pytest apps/register/tests/test_auth.py -s
pytest apps/register/tests/test_clients.py -s
pytest apps/register/tests/test_professionals.py -s



🧼 Rodando testes por função
Cada teste possui um nome iniciando com test_XX_ para facilitar identificação:
pytest apps/register/tests/test_clients.py::test_06_edicao_cliente -s



📁 Estrutura dos arquivos de teste
| Arquivo | Descrição | 
| conftest.py | Fixtures globais: usuários, tokens, clientes | 
| test_auth.py | Login, criação de token, login de profissional/admin | 
| test_clients.py | CRUD de clientes, filtros, ordenações, listagem básica | 
| test_professionals.py | Retorno enxuto dos profissionais (para dropdowns) | 
| test_models.py | (Reservado para testes unitários de modelos, se necessário) | 



🧠 Dicas boas pra manutenção de testes
- Cada função contém print() úteis e mensagens identificadoras
- Os nomes dos testes seguem padrão: test_01_..., test_02_...
- Muitos testes simulam o uso real da API, como faria o frontend
- Comentários com # ▶️ pytest ... no topo de cada teste indicam o comando exato para rodar
