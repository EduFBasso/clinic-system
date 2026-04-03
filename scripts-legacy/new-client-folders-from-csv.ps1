param(
    [Parameter(Mandatory = $true)]
    [string]$CsvPath,

    [string]$BaseDir = "info/clients",

    [switch]$OpenEach
)

if (!(Test-Path -Path $CsvPath)) {
    Write-Error "CSV não encontrado: $CsvPath"
    exit 1
}

$rows = Import-Csv -Path $CsvPath
foreach ($row in $rows) {
    $name = $row.Name
    if ([string]::IsNullOrWhiteSpace($name)) { continue }
    & "$PSScriptRoot/new-client-folder.ps1" -Name $name -BaseDir $BaseDir -Open:$OpenEach
}
