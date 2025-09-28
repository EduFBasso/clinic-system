$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$frontendDir = Join-Path $repoRoot 'frontend'

Push-Location $frontendDir
try {
  $viteBin = Join-Path $frontendDir 'node_modules/.bin/vite.cmd'
  $needsInstall = $false
  if (!(Test-Path -Path (Join-Path $frontendDir 'node_modules'))) { $needsInstall = $true }
  elseif (!(Test-Path -Path $viteBin)) { $needsInstall = $true }

  if ($needsInstall) {
    Write-Host 'Instalando dependências (npm ci)...' -ForegroundColor Cyan
    npm ci
  }
  Write-Host 'Iniciando Vite (npm run dev)...' -ForegroundColor Green
  npm run dev
}
finally {
  Pop-Location
}
