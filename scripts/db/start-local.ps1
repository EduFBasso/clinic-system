param(
    [switch]$NoWait
)

$ErrorActionPreference = 'Stop'

function Require-Docker {
    try {
        docker version | Out-Null
    }
    catch {
        throw "Docker Desktop não está em execução. Abra o Docker Desktop e tente novamente."
    }
}

function Get-RepoRoot {
    # $PSScriptRoot points to scripts/db
    if ($PSScriptRoot) {
        return (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
    }
    # Fallback to MyInvocation if available
    if ($MyInvocation -and $MyInvocation.MyCommand -and $MyInvocation.MyCommand.Path) {
        $here = Split-Path -Parent $MyInvocation.MyCommand.Path
        return (Split-Path -Parent (Split-Path -Parent $here))
    }
    throw "Unable to determine repository root."
}

Require-Docker
$repoRoot = Get-RepoRoot
$compose = Join-Path $repoRoot 'docker-compose.local.yml'
if (-not (Test-Path $compose)) { throw "Arquivo não encontrado: $compose" }

Write-Host "Subindo Postgres local (clinic-local-db) via docker compose..." -ForegroundColor Cyan
docker compose -f $compose up -d --quiet-pull | Out-Null

if (-not $NoWait) {
    Write-Host "Aguardando saúde do container..." -ForegroundColor Cyan
    $name = 'clinic-local-db'
    $max = 30
    for ($i=0; $i -lt $max; $i++) {
        try {
            $status = docker inspect --format '{{.State.Health.Status}}' $name 2>$null
            if ($status -eq 'healthy') { break }
        } catch { }
        Start-Sleep -Seconds 2
    }
    $status = docker inspect --format '{{.State.Health.Status}}' $name 2>$null
    if ($status -ne 'healthy') { throw "Container não ficou 'healthy' a tempo. Status atual: $status" }
}

Write-Host "Postgres local pronto em 127.0.0.1:55432 (DB=clinic_local, user=clinic, pass=clinicpass)" -ForegroundColor Green
