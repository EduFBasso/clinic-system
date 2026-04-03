param(
    [string]$Port = "8000",
    [string]$DbFile = "db.sqlite3",
    [switch]$NoMigrate,
    [switch]$Lan,               # Bind em 0.0.0.0 para acesso via rede local
    [string]$BindHost = ""      # Host explícito (se informado, ignora -Lan)
)

$ErrorActionPreference = 'Stop'

# Resolve paths
$repoRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $repoRoot 'backend'
# Resolve Python from .venv (preferred) or venv
$venvPython = $null
$venvPreferred = Join-Path $repoRoot '.venv\Scripts\python.exe'
$venvAlt = Join-Path $repoRoot 'venv\Scripts\python.exe'
if (Test-Path $venvPreferred) { $venvPython = $venvPreferred }
elseif (Test-Path $venvAlt) { $venvPython = $venvAlt }
else { $venvPython = $venvPreferred }

if (-not (Test-Path $venvPython)) {
    Write-Error "Python venv not found (tried 'venv' and '.venv'). Create/activate the venv first (python -m venv .venv)."
    exit 1
}

if (-not (Test-Path $backendDir)) {
    Write-Error "Backend folder not found at '$backendDir'"
    exit 1
}

# Environment for SQLite run
$env:DEBUG = 'True'
$env:DB_ENGINE = 'django.db.backends.sqlite3'
# Store SQLite DB in backend folder by default
$dbPath = Join-Path $backendDir $DbFile
$env:DB_NAME = $dbPath
## Hosts/CORS permissivos para desenvolvimento
# Para testes em LAN e dispositivos móveis, liberamos hosts e CORS em dev
$env:DJANGO_ALLOWED_HOSTS = '*'
$env:CORS_ALLOW_ALL_ORIGINS = 'True'
$env:CORS_ALLOWED_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173'
## OTP fallback for dev-only usage (enter this code on verify-code as the OTP)
$env:ALLOW_OTP_FALLBACK = 'True'
$env:OTP_FALLBACK_CODE = '1234'

Push-Location $backendDir
try {
    if (-not $NoMigrate) {
        Write-Host "Applying migrations against SQLite DB: $dbPath" -ForegroundColor Cyan
        & $venvPython manage.py migrate
    }

    $hostBind = if ($BindHost) { $BindHost } elseif ($Lan) { '0.0.0.0' } else { '127.0.0.1' }
    Write-Host "Starting Django on http://$hostBind`:$Port (SQLite: $dbPath)" -ForegroundColor Green
    & $venvPython manage.py runserver "$hostBind`:$Port"
}
finally {
    Pop-Location
}
