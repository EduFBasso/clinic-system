param(
  [string]$ListenHost = '127.0.0.1',
  [string]$Port = '8000'
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $repoRoot 'backend'
$venvPython = Join-Path $repoRoot '.venv/Scripts/python.exe'

if (-not (Test-Path $venvPython)) { throw "Venv não encontrado: $venvPython. Rode scripts/setup-venv.ps1" }

# Garante .env para SQLite
$envFile = Join-Path $backendDir '.env'
if (-not (Test-Path $envFile)) {
  Copy-Item (Join-Path $backendDir '.env.sqlite.example') $envFile -Force
}

Push-Location $backendDir
try {
  & $venvPython manage.py migrate --noinput
  & $venvPython manage.py runserver "$ListenHost`:$Port"
}
finally {
  Pop-Location
}
