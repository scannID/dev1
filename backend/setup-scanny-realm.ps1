$ErrorActionPreference = 'Stop'
$kc = 'http://localhost:8080'
$realm = 'scanny'

function Get-AdminToken {
  $body = @{ username = 'admin'; password = 'admin'; grant_type = 'password'; client_id = 'admin-cli' }
  (Invoke-RestMethod -Method Post -Uri "$kc/realms/master/protocol/openid-connect/token" -ContentType 'application/x-www-form-urlencoded' -Body $body).access_token
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

function Ensure-Client($clientId, $port, $lanIp) {
  $existing = Invoke-RestMethod -Method Get -Uri "$kc/admin/realms/$realm/clients?clientId=$clientId" -Headers $H
  $redirectUris = @(
    "http://localhost:$port/*", "http://localhost:$port/",
    "http://127.0.0.1:$port/*", "http://127.0.0.1:$port/"
  )
  $webOrigins = @(
    "http://localhost:$port", "http://127.0.0.1:$port", "+"
  )
  if ($lanIp) {
    $redirectUris += @("http://${lanIp}:$port/*", "http://${lanIp}:$port/")
    $webOrigins += "http://${lanIp}:$port"
  }

  if ($existing.Count -gt 0) {
    # Merge into the existing representation so we never wipe PKCE, scopes, or mappers.
    $id = $existing[0].id
    $full = Invoke-RestMethod -Method Get -Uri "$kc/admin/realms/$realm/clients/$id" -Headers $H
    $full.enabled = $true
    $full.publicClient = $true
    $full.standardFlowEnabled = $true
    $full.directAccessGrantsEnabled = $true
    $full.implicitFlowEnabled = $false
    $full.redirectUris = @($redirectUris)
    $full.webOrigins = @($webOrigins)
    $body = $full | ConvertTo-Json -Depth 10
    Invoke-RestMethod -Method Put -Uri "$kc/admin/realms/$realm/clients/$id" -Headers $H -ContentType 'application/json' -Body $body | Out-Null
    Write-Output "Client $clientId updated (merge)"
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
        'post.logout.redirect.uris' = '+'
      }
      fullScopeAllowed          = $true
    }
    Invoke-RestMethod -Method Post -Uri "$kc/admin/realms/$realm/clients" -Headers $H -ContentType 'application/json' -Body ($cfg | ConvertTo-Json -Depth 5) | Out-Null
    Write-Output "Client $clientId created"
  }
}

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
    Invoke-RestMethod -Method Post -Uri "$kc/admin/realms/$realm/users" -Headers $H -ContentType 'application/json' -Body $userBody | Out-Null
    Write-Output "User $Username created"
  } catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 409) {
      Write-Output "User $Username exists"
      $uid = (Invoke-RestMethod -Method Get -Uri "$kc/admin/realms/$realm/users?username=$Username" -Headers $H)[0].id
      # Keep password in sync for local/dev resets
      $pwdBody = @{ type = 'password'; value = $Password; temporary = $false } | ConvertTo-Json
      Invoke-RestMethod -Method Put -Uri "$kc/admin/realms/$realm/users/$uid/reset-password" -Headers $H -ContentType 'application/json' -Body $pwdBody | Out-Null
    } else {
      throw
    }
  }

  $uid = (Invoke-RestMethod -Method Get -Uri "$kc/admin/realms/$realm/users?username=$Username" -Headers $H)[0].id
  $role = Invoke-RestMethod -Method Get -Uri "$kc/admin/realms/$realm/roles/$RoleName" -Headers $H
  # Windows PowerShell 5.1 unwraps single-element arrays in ConvertTo-Json — force a JSON array.
  $roleJson = '[' + (@{ id = $role.id; name = $role.name } | ConvertTo-Json -Compress) + ']'
  try {
    Invoke-RestMethod -Method Post -Uri "$kc/admin/realms/$realm/users/$uid/role-mappings/realm" -Headers ($H + @{ 'Content-Type' = 'application/json' }) -Body $roleJson | Out-Null
  } catch {
    # Already assigned is fine
  }
  Write-Output "$RoleName role assigned to $Username"
}

$token = Get-AdminToken
$H = @{ Authorization = "Bearer $token" }
Write-Output 'Got admin token'

$lanIp = Get-LanIpv4
if ($lanIp) { Write-Output "LAN IP for redirect URIs: $lanIp" }

# 1) Create realm (ignore if exists)
try {
  $realmBody = @{
    realm                  = $realm
    enabled                = $true
    displayName            = 'Scanny'
    loginWithEmailAllowed  = $true
    duplicateEmailsAllowed = $false
    resetPasswordAllowed   = $true
  } | ConvertTo-Json
  Invoke-RestMethod -Method Post -Uri "$kc/admin/realms" -Headers $H -ContentType 'application/json' -Body $realmBody | Out-Null
  Write-Output "Realm '$realm' created"
} catch {
  if ($_.Exception.Response.StatusCode.value__ -eq 409) { Write-Output "Realm '$realm' already exists" } else { throw }
}

# 2) Realm roles
foreach ($r in 'MERCHANT', 'ADMIN', 'CUSTOMER') {
  try {
    Invoke-RestMethod -Method Post -Uri "$kc/admin/realms/$realm/roles" -Headers $H -ContentType 'application/json' -Body (@{ name = $r } | ConvertTo-Json) | Out-Null
    Write-Output "Role $r created"
  } catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 409) { Write-Output "Role $r exists" } else { throw }
  }
}

# 3) Public clients
Ensure-Client 'scanny-client' 5173 $lanIp
Ensure-Client 'scanny-admin' 5174 $lanIp

# 4) Local users
Ensure-UserWithRole `
  -Username 'testuser' `
  -Email 'testuser@scanny.local' `
  -FirstName 'Test' `
  -LastName 'User' `
  -Password 'password' `
  -RoleName 'MERCHANT'

Ensure-UserWithRole `
  -Username 'adminuser' `
  -Email 'admin@scanny.local' `
  -FirstName 'Scanny' `
  -LastName 'Admin' `
  -Password 'Admin@2026!' `
  -RoleName 'ADMIN'

Ensure-UserWithRole `
  -Username 'samantha@scanny.local' `
  -Email 'samantha@scanny.local' `
  -FirstName 'Samantha' `
  -LastName 'Restaurant' `
  -Password 'Samantha@2026!' `
  -RoleName 'MERCHANT'

Ensure-UserWithRole `
  -Username 'lolo@scanny.local' `
  -Email 'lolo@scanny.local' `
  -FirstName 'Lolo' `
  -LastName 'Foods' `
  -Password 'Lolo@2026!' `
  -RoleName 'MERCHANT'

Write-Output 'DONE'
Write-Output ''
Write-Output 'Local logins:'
Write-Output '  Merchant app  (:5173): samantha@scanny.local / Samantha@2026!'
Write-Output '  Merchant app  (:5173): lolo@scanny.local / Lolo@2026!'
Write-Output '  Merchant app  (:5173): testuser / password'
Write-Output '  Admin console (:5174): adminuser / Admin@2026!'
