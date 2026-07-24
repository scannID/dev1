# Scanny local dev — one command to start Keycloak + backend (+ optional frontends).
# Usage:
#   .\start-dev.ps1              # Keycloak + API (H2)
#   .\start-dev.ps1 -Frontend    # also npm run dev on :5173
#   .\start-dev.ps1 -Admin       # also admin console on :5174
#   .\start-dev.ps1 -All         # everything

param(
    [switch]$Frontend,
    [switch]$Admin,
    [switch]$All,
    [switch]$SkipKeycloak,
    [switch]$SkipBackend,
    [string]$HostIp
)

$ErrorActionPreference = 'Stop'
$Root = $PSScriptRoot
$JavaHome = 'C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot'
$KeycloakBin = Join-Path $Root 'backend\keycloak-26.0.7\bin'
$BackendDir = Join-Path $Root 'backend'
$MavenBin = 'C:\Users\Alsek\tools\apache-maven-3.9.9\bin'
$LauncherDir = Join-Path $Root '.dev\launchers'

if ($HostIp -match '^-') {
    throw "Invalid -HostIp value '$HostIp'. Use -All, -Frontend, or -Admin switches instead."
}

if (-not $HostIp) {
    $HostIp = (
        Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object {
            $_.IPAddress -notlike '127.*' -and
            $_.IPAddress -notlike '169.254.*' -and
            $_.PrefixOrigin -ne 'WellKnown'
        } |
        Select-Object -First 1 -ExpandProperty IPAddress
    )
}

if (-not $HostIp) {
    $HostIp = 'localhost'
}

$ScanBaseUrl = "http://$HostIp`:5173"

if ($All) {
    $Frontend = $true
    $Admin = $true
}

function Test-PortListening([int]$Port) {
    return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1)
}

function Wait-HttpReady {
    param(
        [string]$Url,
        [string]$Label,
        [int]$TimeoutSec = 180
    )
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            $null = Invoke-WebRequest -Uri $Url -TimeoutSec 5 -UseBasicParsing
            Write-Host "  OK $Label" -ForegroundColor Green
            return $true
        } catch {
            if ($_.Exception.Response) {
                Write-Host "  OK $Label (HTTP $([int]$_.Exception.Response.StatusCode))" -ForegroundColor Green
                return $true
            }
        }
        Write-Host "  waiting for $Label..."
        Start-Sleep -Seconds 3
    }
    Write-Host "  TIMEOUT waiting for $Label" -ForegroundColor Red
    return $false
}

function Start-DevWindow {
    param(
        [string]$Name,
        [string]$Title,
        [string]$WorkingDirectory,
        [string[]]$Lines
    )

    New-Item -ItemType Directory -Force -Path $LauncherDir | Out-Null
    $launcher = Join-Path $LauncherDir "$Name.ps1"
    $body = @(
        "`$Host.UI.RawUI.WindowTitle = '$Title'"
        "Set-Location -LiteralPath '$WorkingDirectory'"
    ) + $Lines
    Set-Content -Path $launcher -Value ($body -join "`n") -Encoding UTF8

    Start-Process powershell -ArgumentList @(
        '-NoExit',
        '-ExecutionPolicy', 'Bypass',
        '-File', $launcher
    )
}

Write-Host ''
Write-Host 'Starting Scanny dev stack...' -ForegroundColor Cyan
Write-Host ''

if (-not (Test-Path $JavaHome)) {
    throw "JAVA_HOME not found: $JavaHome"
}

$env:JAVA_HOME = $JavaHome
$env:Path = "$JavaHome\bin;$MavenBin;$env:Path"

if (-not $SkipKeycloak) {
    if (Test-PortListening 8080) {
        Write-Host 'Keycloak already listening on :8080' -ForegroundColor Yellow
    } else {
        if (-not (Test-Path (Join-Path $KeycloakBin 'kc.bat'))) {
            throw "Keycloak not found: $KeycloakBin\kc.bat"
        }
        Write-Host 'Starting Keycloak on :8080...'
        Start-DevWindow -Name 'keycloak' -Title 'Scanny Keycloak' -WorkingDirectory $KeycloakBin -Lines @(
            "`$env:JAVA_HOME = '$JavaHome'"
            "`$env:Path = `"`$env:JAVA_HOME\bin;`$env:Path`""
            "`$env:KC_BOOTSTRAP_ADMIN_USERNAME = 'admin'"
            "`$env:KC_BOOTSTRAP_ADMIN_PASSWORD = 'admin'"
            "`$env:KEYCLOAK_ADMIN = 'admin'"
            "`$env:KEYCLOAK_ADMIN_PASSWORD = 'admin'"
            '.\kc.bat start-dev --http-port=8080'
        )
        Wait-HttpReady -Url 'http://localhost:8080' -Label 'Keycloak :8080' | Out-Null
    }

    $realmSetup = Join-Path $Root 'backend\setup-scanny-realm.ps1'
    if (Test-Path $realmSetup) {
        Write-Host 'Bootstrapping scanny realm (clients + local users)...'
        & $realmSetup
    }
}

if (-not $SkipBackend) {
    if (Test-PortListening 4000) {
        Write-Host 'Backend already listening on :4000' -ForegroundColor Yellow
    } else {
        Write-Host 'Starting backend API on :4000 (profile: h2)...'
        $pexelsKey = $env:PEXELS_API_KEY
        if (-not $pexelsKey) {
            $dotenv = Join-Path $Root '.env'
            if (Test-Path $dotenv) {
                $line = Get-Content $dotenv | Where-Object { $_ -match '^\s*PEXELS_API_KEY\s*=' } | Select-Object -First 1
                if ($line) {
                    $pexelsKey = ($line -replace '^\s*PEXELS_API_KEY\s*=\s*', '').Trim().Trim('"').Trim("'")
                }
            }
        }
        $pexelsLine = if ($pexelsKey) { "`$env:PEXELS_API_KEY = '$pexelsKey'" } else { "`$env:PEXELS_API_KEY = ''" }
        Start-DevWindow -Name 'backend' -Title 'Scanny Backend' -WorkingDirectory $BackendDir -Lines @(
            "`$env:JAVA_HOME = '$JavaHome'"
            "`$env:Path = `"`$env:JAVA_HOME\bin;$MavenBin;`$env:Path`""
            "`$env:SCAN_BASE_URL = '$ScanBaseUrl'"
            $pexelsLine
            '.\mvnw.cmd -q -DskipTests spring-boot:run "-Dspring-boot.run.profiles=h2"'
        )
        Wait-HttpReady -Url 'http://localhost:4000/health' -Label 'API :4000/health' -TimeoutSec 240 | Out-Null
    }
}

if ($Frontend) {
    if (Test-PortListening 5173) {
        Write-Host 'Frontend already listening on :5173' -ForegroundColor Yellow
    } else {
        Write-Host 'Starting merchant app on :5173...'
        Start-DevWindow -Name 'frontend' -Title 'Scanny Frontend' -WorkingDirectory $Root -Lines @(
            "`$env:VITE_API_BASE_URL = 'http://$HostIp`:4000/api'"
            "`$env:VITE_SCAN_BASE_URL = 'http://$HostIp`:5173'"
            "`$env:VITE_WS_BASE_URL = 'ws://$HostIp`:4000'"
            "`$env:VITE_KEYCLOAK_URL = 'http://localhost:8080'"
            'npm run dev -- --host 0.0.0.0 --port 5173'
        )
    }
}

if ($Admin) {
    if (Test-PortListening 5174) {
        Write-Host 'Admin console already listening on :5174' -ForegroundColor Yellow
    } else {
        Write-Host 'Starting admin console on :5174...'
        Start-DevWindow -Name 'admin' -Title 'Scanny Admin' -WorkingDirectory $Root -Lines @(
            "`$env:VITE_API_BASE_URL = 'http://$HostIp`:4000/api'"
            "`$env:VITE_WS_BASE_URL = 'ws://$HostIp`:4000'"
            "`$env:VITE_KEYCLOAK_URL = 'http://localhost:8080'"
            "`$env:VITE_KEYCLOAK_REALM = 'scanny'"
            "`$env:VITE_KEYCLOAK_CLIENT_ID = 'scanny-admin'"
            'npm run dev:admin -- --host 0.0.0.0 --port 5174'
        )
    }
}

Write-Host ''
Write-Host 'Ready:' -ForegroundColor Green
Write-Host '  API:        http://localhost:4000/health'
Write-Host '  Keycloak:   http://localhost:8080/admin  (admin / admin)'
Write-Host '  Merchant:   http://localhost:5173'
Write-Host '  Admin UI:   http://localhost:5174'
Write-Host "  Phone URL:  $ScanBaseUrl"
Write-Host ''
Write-Host 'Local logins:'
Write-Host '  Merchant app  (:5173): samantha@scanny.local / Samantha@2026!'
Write-Host '  Merchant app  (:5173): lolo@scanny.local / Lolo@2026!'
Write-Host '  Merchant app  (:5173): testuser / password'
Write-Host '  Admin console (:5174): adminuser / Admin@2026!'
Write-Host ''
Write-Host 'Each service runs in its own PowerShell window. Close those windows to stop.'
Write-Host 'Or run: .\stop-dev.ps1'
Write-Host ''
