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
        Write-Host "  :$port — nothing listening"
        continue
    }

    $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($pid in $pids) {
        try {
            $proc = Get-Process -Id $pid -ErrorAction Stop
            Write-Host "  :$port — stopping $($proc.ProcessName) (pid $pid)"
            if ($Force) {
                Stop-Process -Id $pid -Force
            } else {
                Stop-Process -Id $pid
            }
        } catch {
            Write-Host "  :$port — could not stop pid $($pid): $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
}

Write-Host ''
Write-Host 'Done. Close any leftover Scanny PowerShell windows if they are still open.'
Write-Host ''
