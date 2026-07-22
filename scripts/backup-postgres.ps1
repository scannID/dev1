# Postgres logical backup for Scanny (Windows / hosted Compose).
# Usage:
#   .\scripts\backup-postgres.ps1
#   $env:POSTGRES_CONTAINER='scanny-postgres'; .\scripts\backup-postgres.ps1

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$BackupDir = if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else { Join-Path $Root 'backups\postgres' }
$RetentionDays = if ($env:RETENTION_DAYS) { [int]$env:RETENTION_DAYS } else { 14 }
$Container = $env:POSTGRES_CONTAINER
$Stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$OutSql = Join-Path $BackupDir "scanny_$Stamp.sql"
$OutGz = "$OutSql.gz"

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

$DbUser = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { 'scanny' }
$DbName = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { 'scanny' }

if ($Container) {
    Write-Host "Backing up via docker exec ($Container) -> $OutGz"
    docker exec $Container pg_dump -U $DbUser -d $DbName --no-owner --no-acl | Set-Content -Path $OutSql -Encoding utf8
} elseif (Get-Command pg_dump -ErrorAction SilentlyContinue) {
    Write-Host "Backing up via local pg_dump -> $OutGz"
    $env:PGPASSWORD = $env:POSTGRES_PASSWORD
    & pg_dump -h ($env:POSTGRES_HOST ?? 'localhost') -p ($env:POSTGRES_PORT ?? '5432') -U $DbUser -d $DbName --no-owner --no-acl |
        Set-Content -Path $OutSql -Encoding utf8
} else {
    throw 'Neither POSTGRES_CONTAINER nor pg_dump available.'
}

Compress-Archive -Path $OutSql -DestinationPath ($OutGz -replace '\.gz$','.zip') -Force
Remove-Item $OutSql -Force
$ZipOut = $OutGz -replace '\.gz$','.zip'
Write-Host "OK $ZipOut"

Get-ChildItem $BackupDir -Filter 'scanny_*.zip' |
    Where-Object { $_.LastWriteTimeUtc -lt (Get-Date).ToUniversalTime().AddDays(-$RetentionDays) } |
    Remove-Item -Force
