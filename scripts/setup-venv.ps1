param(
  [switch]$Recreate
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$venvPath = Join-Path $repoRoot '.venv'
$venvPython = Join-Path $venvPath 'Scripts/python.exe'

if ($Recreate -and (Test-Path $venvPath)) {
  Write-Host "Removendo venv existente em $venvPath" -ForegroundColor Yellow
  Remove-Item -Recurse -Force $venvPath
}

if (-not (Test-Path $venvPython)) {
  Write-Host 'Criando ambiente virtual (.venv) com Python 3.13...' -ForegroundColor Cyan
  & py -3.13 -m venv $venvPath
}

if (-not (Test-Path $venvPython)) {
  throw "Falha ao criar o venv em $venvPath"
}

Write-Host 'Atualizando pip/setuptools/wheel...' -ForegroundColor Cyan
& $venvPython -m pip install --upgrade pip setuptools wheel | Write-Host

Write-Host 'Instalando dependências do backend...' -ForegroundColor Cyan
& $venvPython -m pip install -r (Join-Path $repoRoot 'backend/requirements.txt')

Write-Host "Venv pronto: $venvPython" -ForegroundColor Green
