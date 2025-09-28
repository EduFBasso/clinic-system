param(
  [switch]$LAN,
  [string]$LanIp,
  [string]$BackendPort = '8000',
  [string]$FrontendPort = '5173',
  [switch]$RecreateVenv,
  [switch]$OpenBrowser
)

$ErrorActionPreference = 'Stop'

function Get-PrivateLanIPv4s {
  $candidates = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object {
      $_.IPAddress -match '^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)' -and
      $_.PrefixOrigin -ne 'WellKnown' -and
      $_.IPAddress -notmatch '^169\.254\.'
    } |
    Sort-Object -Property InterfaceMetric, SkipAsSource |
    Select-Object -ExpandProperty IPAddress
  $uniq = @()
  foreach ($ip in $candidates) { if ($uniq -notcontains $ip) { $uniq += $ip } }
  return $uniq
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$scriptsDir = $PSScriptRoot

# 1) Venv ready
if ($RecreateVenv) {
  powershell -ExecutionPolicy Bypass -File (Join-Path $scriptsDir 'setup-venv.ps1') -Recreate
} else {
  powershell -ExecutionPolicy Bypass -File (Join-Path $scriptsDir 'setup-venv.ps1')
}

# 2) Start backend (new window)
if ($LAN) {
  $backendArgs = "-File `"$scriptsDir/run-backend-lan.ps1`" -Port $BackendPort"
  # -NoExit mantém a janela aberta caso ocorra erro no backend (útil para diagnosticar)
  Start-Process -WindowStyle Normal -FilePath powershell -ArgumentList "-NoLogo","-NoProfile","-ExecutionPolicy","Bypass","-NoExit",$backendArgs
} else {
  $backendArgs = "-File `"$scriptsDir/run-backend-local.ps1`" -ListenHost 127.0.0.1 -Port $BackendPort"
  # -NoExit mantém a janela aberta caso ocorra erro no backend (útil para diagnosticar)
  Start-Process -WindowStyle Normal -FilePath powershell -ArgumentList "-NoLogo","-NoProfile","-ExecutionPolicy","Bypass","-NoExit",$backendArgs
}

# 3) Determine backend URL for frontend
if ($LAN) {
  $useIp = $LanIp
  if ([string]::IsNullOrWhiteSpace($useIp)) {
    $ips = Get-PrivateLanIPv4s
    if (-not $ips -or $ips.Count -eq 0) { throw 'Nenhum IP de LAN encontrado. Use -LanIp para especificar.' }
    $useIp = $ips[0]
  }
  $backendUrl = "http://${useIp}:${BackendPort}"
} else {
  $backendUrl = "http://127.0.0.1:${BackendPort}"
}

Write-Host ("Backend URL para o frontend: {0}" -f $backendUrl) -ForegroundColor Green

# 4) Start frontend (new window) with VITE_API_BASE override and port
$frontendCmd = @(
  "Set-Location `"$repoRoot/frontend`"",
  # instala deps se necessario
  "if (!(Test-Path node_modules) -or -not (Test-Path 'node_modules/.bin/vite.cmd')) { npm ci }",
  # define VITE_API_BASE no ambiente da sessão do PowerShell antes de iniciar o Vite
  "$env:VITE_API_BASE = '$backendUrl'",
  "npm run dev -- --port $FrontendPort"
) -join '; '

Start-Process -WindowStyle Normal -FilePath powershell -ArgumentList "-NoLogo","-NoProfile","-ExecutionPolicy","Bypass","-NoExit","-Command",$frontendCmd

if ($OpenBrowser) {
  if ($LAN) {
    # Em LAN, o Vite mostra um endereço Network. Abriremos o Local por padrão.
    Start-Process "http://localhost:$FrontendPort"
  } else {
    Start-Process "http://localhost:$FrontendPort"
  }
}

Write-Host "start-dev: backend e frontend iniciados em janelas separadas." -ForegroundColor Cyan
