param(
    [Parameter(Mandatory = $true)]
    [string]$Name,

    [string]$BaseDir = "info/clients",

    [switch]$Open
)

function Get-SafeName([string]$n) {
    $s = $n.Trim()
    $s = $s -replace '[\\/:*?"<>|]', ' '
    $s = $s -replace '\s+', ' '
    $s = $s.Trim()
    $s = $s -replace ' ', '_'
    return $s
}

try {
    $repoRoot = Split-Path -Parent $PSScriptRoot
    $targetBase = Join-Path -Path $repoRoot -ChildPath $BaseDir
    $safe = Get-SafeName -n $Name
    $clientDir = Join-Path -Path $targetBase -ChildPath $safe

    # Cria estrutura
    New-Item -ItemType Directory -Path $clientDir -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $clientDir 'docs') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $clientDir 'scans') -Force | Out-Null

    # .gitkeep para manter pastas vazias no git
    $null = New-Item -ItemType File -Path (Join-Path $clientDir 'docs/.gitkeep') -Force
    $null = New-Item -ItemType File -Path (Join-Path $clientDir 'scans/.gitkeep') -Force

    # Arquivos padrão
    $created = Get-Date -Format 'yyyy-MM-dd HH:mm'
    $readme = @"
# Cliente: $Name

- Criado em: $created
- Pasta: $safe

## Contatos
- Telefone:
- WhatsApp:
- E-mail:
- Responsável:

## Observações
- 

## Documentos
- Coloque PDFs e imagens em `docs/` (documentos) e `scans/` (digitalizações)

> Observação: Evite commitar dados sensíveis (LGPD). Se necessário, use criptografia ou mantenha fora do repositório.
"@
    Set-Content -Path (Join-Path $clientDir 'README.md') -Value $readme -Encoding UTF8

    if ($Open) {
        try { Invoke-Item -Path $clientDir } catch {}
    }

    Write-Host "Pasta criada:" -ForegroundColor Green -NoNewline
    Write-Host " $clientDir"
} catch {
    Write-Error $_
    exit 1
}
