# Reset local Windows PostgreSQL 16 password for Beekeeper.
# Must run as Administrator.

$ErrorActionPreference = 'Stop'
$PgHba = 'C:\Program Files\PostgreSQL\16\data\pg_hba.conf'
$Backup = "$PgHba.bak-scanny-$(Get-Date -Format yyyyMMddHHmmss)"
$NewPassword = if ($env:POSTGRES_RESET_PASSWORD) { $env:POSTGRES_RESET_PASSWORD } else { 'scanny' }
$ServiceName = 'postgresql-x64-16'
$Psql = 'C:\Program Files\PostgreSQL\16\bin\psql.exe'
if (-not (Test-Path $Psql)) { $Psql = 'psql' }

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    throw 'Run this script in an elevated PowerShell (Run as administrator).'
}

if (-not (Test-Path $PgHba)) {
    throw "pg_hba.conf not found: $PgHba"
}

Copy-Item $PgHba $Backup -Force
Write-Host "Backed up pg_hba to $Backup"

$original = Get-Content $PgHba -Raw
$trusted = $original `
    -replace '(?m)^(host\s+all\s+all\s+127\.0\.0\.1/32\s+)\S+', '${1}trust' `
    -replace '(?m)^(host\s+all\s+all\s+::1/128\s+)\S+', '${1}trust' `
    -replace '(?m)^(local\s+all\s+all\s+)\S+', '${1}trust'

Set-Content -Path $PgHba -Value $trusted -Encoding ascii
Restart-Service $ServiceName -Force
Start-Sleep -Seconds 4

$sql = @"
DO `$`$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'scanny') THEN
    CREATE ROLE scanny LOGIN PASSWORD '$NewPassword';
  ELSE
    ALTER ROLE scanny WITH LOGIN PASSWORD '$NewPassword';
  END IF;
  ALTER ROLE postgres WITH PASSWORD '$NewPassword';
END
`$`$;
SELECT CASE WHEN EXISTS (SELECT FROM pg_database WHERE datname = 'scanny')
  THEN 'db exists' ELSE 'db missing' END AS db_status;
"@

& $Psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1 -c $sql

$dbCheck = & $Psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'scanny'"
if (-not $dbCheck.Trim()) {
    & $Psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE scanny OWNER scanny;"
}

Set-Content -Path $PgHba -Value $original -Encoding ascii
Restart-Service $ServiceName -Force
Start-Sleep -Seconds 4

$env:PGPASSWORD = $NewPassword
& $Psql -h 127.0.0.1 -p 5432 -U scanny -d scanny -c "SELECT current_user, current_database();"

Write-Host ""
Write-Host "SUCCESS — use these in Beekeeper:" -ForegroundColor Green
Write-Host "  Host:     localhost"
Write-Host "  Port:     5432"
Write-Host "  User:     scanny"
Write-Host "  Password: $NewPassword"
Write-Host "  Database: scanny"
