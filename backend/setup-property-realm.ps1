# ──────────────────────────────────────────────────────────────────────────────
# setup-property-realm.ps1
#
# Creates (or updates) the 'scanny-property' Keycloak realm used exclusively
# by the Property Management product.
#
# Usage:
#   .\setup-property-realm.ps1
#
# Prerequisites: Keycloak running on http://localhost:8080, admin:admin
# ──────────────────────────────────────────────────────────────────────────────
$ErrorActionPreference = 'Stop'
$kc    = 'http://localhost:8080'
$realm = 'scanny-property'

function Get-AdminToken {
  $body = @{ username = 'admin'; password = 'admin'; grant_type = 'password'; client_id = 'admin-cli' }
  (Invoke-RestMethod -Method Post -Uri "$kc/realms/master/protocol/openid-connect/token" `
    -ContentType 'application/x-www-form-urlencoded' -Body $body).access_token
}

function Get-LanIpv4 {
  $ip = (
    Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPAddress -notlike '127.*' -and
      $_.IPAddress -notlike '169.254.*' -and
      $_.PrefixOrigin -ne 'WellKnown'
    } |
    Select-Object -First 1 -ExpandProperty IPAddress
  )
  if ($ip) { return $ip }
  return $null
}

# Create / update a public PKCE client
function Ensure-Client($clientId, $port, $lanIp) {
  $redirectUris = @(
    "http://localhost:$port/*",   "http://localhost:$port/",
    "http://127.0.0.1:$port/*",  "http://127.0.0.1:$port/",
    "https://localhost:$port/*",  "https://localhost:$port/",
    "https://127.0.0.1:$port/*", "https://127.0.0.1:$port/"
  )
  $webOrigins = @(
    "http://localhost:$port", "http://127.0.0.1:$port",
    "https://localhost:$port", "https://127.0.0.1:$port", "+"
  )
  if ($lanIp) {
    $redirectUris += @(
      "http://${lanIp}:$port/*",  "http://${lanIp}:$port/",
      "https://${lanIp}:$port/*", "https://${lanIp}:$port/"
    )
    $webOrigins += @("http://${lanIp}:$port", "https://${lanIp}:$port")
  }

  $existing = Invoke-RestMethod -Method Get `
    -Uri "$kc/admin/realms/$realm/clients?clientId=$clientId" -Headers $H

  if ($existing.Count -gt 0) {
    $id   = $existing[0].id
    $full = Invoke-RestMethod -Method Get -Uri "$kc/admin/realms/$realm/clients/$id" -Headers $H
    $full.enabled                   = $true
    $full.publicClient              = $true
    $full.standardFlowEnabled       = $true
    $full.directAccessGrantsEnabled = $true
    $full.implicitFlowEnabled       = $false
    $full.redirectUris              = @($redirectUris)
    $full.webOrigins                = @($webOrigins)
    $body = $full | ConvertTo-Json -Depth 10
    Invoke-RestMethod -Method Put -Uri "$kc/admin/realms/$realm/clients/$id" `
      -Headers $H -ContentType 'application/json' -Body $body | Out-Null
    Write-Output "Client '$clientId' updated"
  } else {
    $cfg = @{
      clientId                  = $clientId
      name                      = $clientId
      enabled                   = $true
      protocol                  = 'openid-connect'
      publicClient              = $true
      standardFlowEnabled       = $true
      directAccessGrantsEnabled = $true
      implicitFlowEnabled       = $false
      redirectUris              = $redirectUris
      webOrigins                = $webOrigins
      attributes                = @{
        'pkce.code.challenge.method' = 'S256'
        'post.logout.redirect.uris'  = '+'
      }
      fullScopeAllowed          = $true
    }
    Invoke-RestMethod -Method Post -Uri "$kc/admin/realms/$realm/clients" `
      -Headers $H -ContentType 'application/json' -Body ($cfg | ConvertTo-Json -Depth 5) | Out-Null
    Write-Output "Client '$clientId' created"
  }
}

# Create / update a user and assign a realm role
function Ensure-UserWithRole {
  param(
    [string]$Username,
    [string]$Email,
    [string]$FirstName,
    [string]$LastName,
    [string]$Password,
    [string]$RoleName
  )

  $userBody = @{
    username      = $Username
    email         = $Email
    enabled       = $true
    emailVerified = $true
    firstName     = $FirstName
    lastName      = $LastName
    credentials   = @(@{ type = 'password'; value = $Password; temporary = $false })
  } | ConvertTo-Json -Depth 5

  try {
    Invoke-RestMethod -Method Post -Uri "$kc/admin/realms/$realm/users" `
      -Headers $H -ContentType 'application/json' -Body $userBody | Out-Null
    Write-Output "User '$Username' created"
  } catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 409) {
      Write-Output "User '$Username' already exists — syncing password"
      $uid = (Invoke-RestMethod -Method Get `
        -Uri "$kc/admin/realms/$realm/users?username=$Username" -Headers $H)[0].id
      $pwdBody = @{ type = 'password'; value = $Password; temporary = $false } | ConvertTo-Json
      Invoke-RestMethod -Method Put -Uri "$kc/admin/realms/$realm/users/$uid/reset-password" `
        -Headers $H -ContentType 'application/json' -Body $pwdBody | Out-Null
    } else { throw }
  }

  $uid  = (Invoke-RestMethod -Method Get `
    -Uri "$kc/admin/realms/$realm/users?username=$Username" -Headers $H)[0].id
  $role = Invoke-RestMethod -Method Get -Uri "$kc/admin/realms/$realm/roles/$RoleName" -Headers $H
  # Force a JSON array (PS5.1 unwraps single-element arrays)
  $roleJson = '[' + (@{ id = $role.id; name = $role.name } | ConvertTo-Json -Compress) + ']'
  try {
    Invoke-RestMethod -Method Post `
      -Uri "$kc/admin/realms/$realm/users/$uid/role-mappings/realm" `
      -Headers ($H + @{ 'Content-Type' = 'application/json' }) -Body $roleJson | Out-Null
  } catch { <# already assigned — fine #> }
  Write-Output "Role '$RoleName' assigned to '$Username'"
}

# ── Bootstrap ──────────────────────────────────────────────────────────────────

$token = Get-AdminToken
$H     = @{ Authorization = "Bearer $token" }
Write-Output 'Got admin token'

$lanIp = Get-LanIpv4
if ($lanIp) { Write-Output "LAN IP: $lanIp" }

# 1) Realm
try {
  $realmBody = @{
    realm                  = $realm
    enabled                = $true
    displayName            = 'Scanny Property'
    loginWithEmailAllowed  = $true
    duplicateEmailsAllowed = $false
    resetPasswordAllowed   = $true
  } | ConvertTo-Json
  Invoke-RestMethod -Method Post -Uri "$kc/admin/realms" `
    -Headers $H -ContentType 'application/json' -Body $realmBody | Out-Null
  Write-Output "Realm '$realm' created"
} catch {
  if ($_.Exception.Response.StatusCode.value__ -eq 409) {
    Write-Output "Realm '$realm' already exists"
  } else { throw }
}

# 2) Realm roles
foreach ($r in 'PROPERTY_MANAGER') {
  try {
    Invoke-RestMethod -Method Post -Uri "$kc/admin/realms/$realm/roles" `
      -Headers $H -ContentType 'application/json' -Body (@{ name = $r } | ConvertTo-Json) | Out-Null
    Write-Output "Role '$r' created"
  } catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 409) {
      Write-Output "Role '$r' already exists"
    } else { throw }
  }
}

# 3) Public OIDC client (same frontend port 5173)
Ensure-Client 'scanny-property-client' 5173 $lanIp

# 4) Test user
Ensure-UserWithRole `
  -Username    'propmanager@scanny.local' `
  -Email       'propmanager@scanny.local' `
  -FirstName   'Demo' `
  -LastName    'Property Manager' `
  -Password    'PropManager@2026!' `
  -RoleName    'PROPERTY_MANAGER'

Write-Output ''
Write-Output 'DONE'
Write-Output ''
Write-Output 'Property Management test login:'
Write-Output "  URL      : http://localhost:5173/rent/dashboard"
Write-Output "  Username : propmanager@scanny.local"
Write-Output "  Password : PropManager@2026!"
