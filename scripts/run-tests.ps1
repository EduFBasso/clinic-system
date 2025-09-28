$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $repoRoot 'backend'
$venvPython = Join-Path $repoRoot '.venv/Scripts/python.exe'

if (-not (Test-Path $venvPython)) { throw "Venv não encontrado: $venvPython. Rode scripts/setup-venv.ps1" }

Push-Location $backendDir
try {
  # Usa SQLite em memória durante pytest (settings.py já alterna para sqlite quando PYTEST_CURRENT_TEST existe)
  & $venvPython -m pytest -q
}
finally {
  Pop-Location
}
