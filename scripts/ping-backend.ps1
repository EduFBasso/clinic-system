param(
    [string]$Url = "https://clinic-system-swzd.onrender.com/health",
    [int]$IntervalSeconds = 600 # 10 minutos por padrão
)

Write-Host "Keep-alive: pingando $Url a cada $IntervalSeconds segundos. Ctrl+C para parar." -ForegroundColor Cyan

while ($true) {
    try {
        $t0 = Get-Date
        $resp = Invoke-WebRequest -Uri $Url -Method GET -UseBasicParsing -TimeoutSec 15
        $elapsed = (Get-Date) - $t0
        $ms = [int]$elapsed.TotalMilliseconds
        $code = if ($resp.StatusCode) { $resp.StatusCode } else { $resp.StatusCode }
        Write-Host ("{0:u} {1} {2}ms" -f (Get-Date), $code, $ms)
    } catch {
        Write-Warning ("{0:u} erro: {1}" -f (Get-Date), $_.Exception.Message)
    }
    Start-Sleep -Seconds $IntervalSeconds
}
