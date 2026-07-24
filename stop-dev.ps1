# Stop Scanny dev processes started by start-dev.ps1 (ports 4000, 8080, 5173, 5174).

param(
    [switch]$Force
)

$ports = @(4000, 8080, 5173, 5174)

Write-Host ''
Write-Host 'Stopping Scanny dev services...' -ForegroundColor Cyan

foreach ($port in $ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if (-not $connections) {
        Write-Host "  :$port - nothing listening"
        continue
    }

    $procIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($procId in $procIds) {
        try {
            $proc = Get-Process -Id $procId -ErrorAction Stop
            Write-Host "  :$port - stopping $($proc.ProcessName) (pid $procId)"
            if ($Force) {
                Stop-Process -Id $procId -Force
            } else {
                Stop-Process -Id $procId -Force
            }
        } catch {
            $msg = $_.Exception.Message
            Write-Host "  :$port - could not stop pid ${procId}: $msg" -ForegroundColor Yellow
        }
    }
}

Write-Host ''
Write-Host 'Done. Close any leftover Scanny PowerShell windows if they are still open.'
Write-Host ''
