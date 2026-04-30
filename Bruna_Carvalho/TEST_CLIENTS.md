# Clientes com Arcada Dentária Migrada — Para Testes Manuais

## Resumo

Total de 213 clientes com dados de arcada migrados no banco.

7 clientes com auditorias geradas:

| ID | Cliente | Arcade ID | Procs | Status |
|---|---|---|---|---|
| **51** | Marabel Aparecida Cavinato Carvalho | 2455 | 1 | pending |
| **350** | Fabiano D'Andrea | TBD | TBD | TBD |
| **390** | Flavia Ottani Silva Uniodonto | 2549 | 4 | pending |
| **42** | Julia Domiciana Franco de Campo | 2437,2436,2423,2217 | 1,0,1,0 | pending |
| **440** | Fernanda Amaro Brandao Santos | TBD | TBD | TBD |
| **794** | Silmara Cristina Diotto Telle | TBD | TBD | TBD |
| **357** | Angelo Zambom Netto | TBD | TBD | TBD |

## Como Usar

### 1. Testar na UI

Acesse: `http://localhost:5173/odonto/arcada/<CLIENT_ID>`

Exemplo: `http://localhost:5173/odonto/arcada/42`

### 2. Inspecionar dados no shell Django

```bash
cd backend
source .venv/bin/activate
python manage.py shell
```

```python
from apps.odonto.models import Procedure, DentalArcade, Tooth
from apps.clients.models import Client

client = Client.objects.get(id=42)
arcades = DentalArcade.objects.filter(client=client)
for arcade in arcades:
    procs = Procedure.objects.filter(arcade=arcade)
    print(f"Arcade {arcade.id}: {procs.count()} procedures")
    for p in procs[:3]:
        print(f"  - id={p.id} | tooth={p.tooth_id} | status={p.status} | started_at={p.started_at} | completed_at={p.completed_at}")
```

### 3. Inspecionar dados com audit JSON

Cada arquivo `audit_client_<ID>.json` contém:
- Client metadata
- List of arcades with procedure counts and status distribution

## Recomendações de Teste

- **ID 51** (Marabel): 1 proc → teste simples, comportamento básico
- **ID 390** (Flavia): 4 procs → teste com múltiplos procedimentos
- **ID 42** (Julia): múltiplas arcades → teste com estrutura mais complexa

## Observações

- ✓ Todos os clientes têm `started_at=null` na migração
- ✓ Muitos têm `completed_at` preenchido mas `status=pending` (anomalia conhecida, foi corrigida no UI)
- ✓ Ambiente é local, seguro para experimenta alterações
