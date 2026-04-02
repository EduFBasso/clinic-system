param(
    [int]$Port = 8000,
    [string]$RuleName = "Clinic Django Dev $($Port)",
    [ValidateSet('Private','Domain','Public')]
    [string[]]$Profiles = @('Private')
)

$ErrorActionPreference = 'Stop'

# Check elevation
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)) {
    Write-Error "This script must be run as Administrator to create firewall rules. Right-click PowerShell and 'Run as administrator'."
    exit 1
}

# Create or update inbound rule for TCP port
$existing = Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue
if ($null -eq $existing) {
    Write-Host "Creating inbound firewall rule '$RuleName' for TCP port $Port on profiles: $($Profiles -join ', ')" -ForegroundColor Cyan
    New-NetFirewallRule -DisplayName $RuleName -Direction Inbound -LocalPort $Port -Protocol TCP -Action Allow -Profile $Profiles | Out-Null
} else {
    Write-Host "Firewall rule '$RuleName' already exists. Ensuring settings..." -ForegroundColor Yellow
    Set-NetFirewallRule -DisplayName $RuleName -Direction Inbound -Action Allow -Profile $Profiles | Out-Null
    Set-NetFirewallPortFilter -AssociatedNetFirewallRule $existing -Protocol TCP -LocalPort $Port | Out-Null
}

# Optional: show a summary
Get-NetFirewallRule -DisplayName $RuleName |
    Get-NetFirewallPortFilter |
    Select-Object Name, Protocol, LocalPort |
    Format-Table -AutoSize