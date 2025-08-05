# Clinic System Backend

Este diretório contém o backend do sistema de gerenciamento de clínica de podologia.

## Estrutura

- `apps/register/`: App principal com modelos, views, serializers, serviços e testes.
- `clinic_system/`: Configurações globais do projeto Django.
- `manage.py`: Script para comandos administrativos Django.

## Como rodar localmente

1. Instale as dependências:

   ```
   pip install -r requirements.txt
   ```

2. Execute as migrações:

   ```
   python manage.py migrate
   ```

3. Inicie o servidor:
   ```
   python manage.py runserver
   ```

## Rodando os testes

```
python manage.py test
```

## Observações

- O login é feito via código OTP enviado por e-mail.
- Cada profissional só visualiza seus próprios clientes.
- Para produção, configure variáveis de ambiente para dados
