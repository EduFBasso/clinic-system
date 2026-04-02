# Scripts Operacionais

Este diretório contém scripts e ferramentas para operação do sistema em desenvolvimento local e em rede.

## Ativo (necessário para execução)

| Script                | Propósito                                                        | Plataforma  |
| --------------------- | ---------------------------------------------------------------- | ----------- |
| `run-backend-lan.sh`  | Subir Django em LAN (0.0.0.0:8000) com CORS/HOSTS auto-detectado | macOS/Linux |
| `run-frontend-lan.sh` | Subir Vite em LAN (0.0.0.0:5173)                                 | macOS/Linux |
| `db/`                 | Subpasta com scripts de backup/restore e documentação Postgres   | todas       |
| `docker-init.sql`     | Inicialização do banco local (usado no docker-compose)           | Docker      |

## Uso

### Executar backend em LAN

```bash
chmod +x scripts/run-backend-lan.sh
./scripts/run-backend-lan.sh
```

### Executar frontend em LAN

```bash
chmod +x scripts/run-frontend-lan.sh
./scripts/run-frontend-lan.sh
```

### Backup do banco local

Ver [db/README.md](db/README.md).

## Legado

Scripts obsoletos foram movidos para `scripts-legacy/` por não serem mais necessários:

- Windows PowerShell scripts (`.ps1`) — sistema desenvolvido originalmente em Windows, agora macOS/Linux
- `test-finalize-appointment.mjs` — teste isolado, não integrado ao fluxo de CI

Ver [../scripts-legacy/README.md](../scripts-legacy/README.md) para contexto histórico.
