<#
 Run Django backend for LAN testing: exposes 0.0.0.0:8000 and sets ALLOWED_HOSTS/CORS
 to include ALL active LAN IPv4 addresses on this machine. This avoids CORS/host
 mismatches when you access from a phone using 192.168.x while Docker/WSL exposes 172.x.
#>
param(
    [string]$Port = "8000"
)

$ErrorActionPreference = 'Stop'

function Get-LanIPv4s {
    $candidates = Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object {
            $_.IPAddress -match '^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)' -and
            $_.PrefixOrigin -ne 'WellKnown' -and
            $_.IPAddress -notmatch '^169\.254\.'
        } |
        Sort-Object -Property InterfaceMetric, SkipAsSource |
        Select-Object -ExpandProperty IPAddress
    $uniq = @()
    foreach ($ip in $candidates) {
        if ($uniq -notcontains $ip) { $uniq += $ip }
    }
    return $uniq
}

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$backendDir = Join-Path $repoRoot 'backend'
$venvPython = Join-Path $repoRoot 'venv/Scripts/python.exe'

if (-not (Test-Path $venvPython)) {
    throw "Python venv not found at $venvPython. Activate venv or adjust the path."
}

$ips = Get-LanIPv4s
if (-not $ips -or $ips.Count -eq 0) { throw 'No LAN IPv4 address found.' }

Write-Host ("Using LAN IPs: {0}" -f ($ips -join ', ')) -ForegroundColor Green

# Compose env vars
$allowedHosts = @('localhost','127.0.0.1') + $ips
$env:DJANGO_ALLOWED_HOSTS = ($allowedHosts -join ',')

$corsOrigins = @('http://localhost:5173','http://127.0.0.1:5173')
foreach ($h in $ips) { $corsOrigins += "http://$h:5173" }
$env:CORS_ALLOWED_ORIGINS = ($corsOrigins -join ',')

Push-Location $backendDir
try {
    & $venvPython manage.py runserver 0.0.0.0:$Port
}
finally {
    Pop-Location
}
