# Backup local do Postgres rodando no Docker
# Gera arquivo .sql.gz em scripts/db/backups

param(
  [string]$ContainerName = 'clinic-local-db',
  [string]$DbName = 'clinic_local',
  [string]$DbUser = 'clinic'
)

$ErrorActionPreference = 'Stop'

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$target = Join-Path $here 'backups'
New-Item -ItemType Directory -Force -Path $target | Out-Null

$ts = Get-Date -Format 'yyyyMMdd-HHmmss'
$fn = Join-Path $target ("$($DbName)-$ts.sql.gz")

Write-Host "Fazendo dump do banco '$DbName' do container '$ContainerName'..."

# Executa pg_dump dentro do container e comprime com gzip
# Usa o POSTGRES_USER padrão do ambiente local (trust auth)
docker exec $ContainerName sh -lc "pg_dump -U $DbUser $DbName | gzip -9" | Set-Content -Path $fn -Encoding Byte

Write-Host "Backup gerado em: $fn"
