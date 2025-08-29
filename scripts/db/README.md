# Backups do Postgres

Este diretório contém scripts e instruções para backups.

Ambientes:

- Local (Docker): usa o contêiner `clinic-local-db` (porta host 55432) e o banco `clinic_local`.
- Produção/Staging (Render): use variáveis de ambiente do serviço e um usuário de backup somente-leitura.

## Usuário de backup (somente leitura)

Crie um usuário de backup com:

- Permissão de CONNECT no banco
- USAGE no schema `public`
- SELECT em todas as tabelas e futuras tabelas

SQL (rode no psql como um superuser):

```sql
-- 1) criar usuário
CREATE USER backup_ro WITH PASSWORD 'defina-uma-senha-forte';

-- 2) permissões existentes
GRANT CONNECT ON DATABASE clinic_local TO backup_ro;
GRANT USAGE ON SCHEMA public TO backup_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO backup_ro;

-- 3) permissões futuras
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO backup_ro;
```

No Render/produção, substitua `clinic_local` pelo nome do DB de produção e execute via console/psql.

## Dump completo

- Local Docker (Windows PowerShell):

```powershell
# backup com data no nome
$ts = Get-Date -Format 'yyyyMMdd-HHmmss'
$fn = "backup-local-$ts.sql.gz"
# Usa o psql dentro do container
docker exec clinic-local-db sh -lc "pg_dump -U clinic clinic_local | gzip -9" > $fn
Write-Host "Backup salvo: $fn"
```

- Remoto (Render):
  Use `pg_dump` com a URL do banco (DATABASE_URL) e o usuário de backup. Exemplo:

```powershell
$env:PGPASSWORD = 'SENHA_BACKUP';
pg_dump -h HOST -p PORT -U backup_ro -d DBNAME -F c -Z 9 -f backup-prod-$(Get-Date -Format 'yyyyMMdd-HHmmss').dump
Remove-Item Env:PGPASSWORD
```

## Restauração (local)

```powershell
# .dump (formato custom)
pg_restore -h 127.0.0.1 -p 55432 -U clinic -d clinic_local --clean --if-exists backup-file.dump

# .sql.gz
gzip -dc backup-file.sql.gz | psql -h 127.0.0.1 -p 55432 -U clinic -d clinic_local
```

## Retenção

- Guarde apenas N arquivos mais recentes (por exemplo 7 diários).
- Para produção, armazene os dumps em um bucket S3 ou similar com criptografia.
