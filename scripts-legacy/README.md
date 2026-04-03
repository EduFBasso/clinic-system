# Scripts Legado

Este diretório contém scripts históricos que não são mais utilizados no fluxo operacional atual.

## Motivos de Arquivamento

| Script                                                     | Motivo                                                                                                          |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `*.ps1` (PowerShell)                                       | Sistema desenvolvido originalmente em Windows. Migrate para macOS/Bash equivalents (`run-backend-lan.sh`, etc.) |
| `test-finalize-appointment.mjs`                            | Teste isolado do Node.js. Não integrado a CI/testes. Candidato a remover ou integrar a vitest.                  |
| `ping-backend.ps1`                                         | Validação HTTP simples; substituído por `docker compose ps` + `curl http://localhost:8000/health`               |
| `new-client-folder.ps1`, `new-client-folders-from-csv.ps1` | Migrações de dados para testes. Não aplicável a modelos atuais.                                                 |
| `open-firewall-8000.ps1`                                   | Configuração Windows firewall. Não necessária em macOS/Linux.                                                   |

## Retenção

Mantém-se aqui por razões de rastreabilidade (git history + documentação). Remover de produção não prejudica operação.

## Próximos Passos

- Integrar testes JavaScript reais em CI/CD (se necessário, converter `test-finalize-appointment.mjs` para Vitest + pytest).
- Remover este diretório do repositório após 1-2 releases em produção (segurança acumulada).
