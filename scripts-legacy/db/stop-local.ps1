$ErrorActionPreference = 'Stop'

function Require-Docker {
    try { docker version | Out-Null } catch { throw "Docker Desktop não está em execução." }
}

Require-Docker

Write-Host "Parando e removendo container clinic-local-db..." -ForegroundColor Cyan
docker rm -f clinic-local-db 2>$null | Out-Null
Write-Host "OK." -ForegroundColor Green
