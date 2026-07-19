$ErrorActionPreference = 'Stop'
$kc = 'http://localhost:8080'
$realm = 'scanny'

function Get-AdminToken {
  $body = @{ username='admin'; password='admin'; grant_type='password'; client_id='admin-cli' }
  (Invoke-RestMethod -Method Post -Uri "$kc/realms/master/protocol/openid-connect/token" -ContentType 'application/x-www-form-urlencoded' -Body $body).access_token
}

$token = Get-AdminToken
$H = @{ Authorization = "Bearer $token" }
Write-Output 'Got admin token'

# 1) Create realm (ignore if exists)
try {
  $realmBody = @{ realm=$realm; enabled=$true; displayName='Scanny'; loginWithEmailAllowed=$true; duplicateEmailsAllowed=$false; resetPasswordAllowed=$true } | ConvertTo-Json
  Invoke-RestMethod -Method Post -Uri "$kc/admin/realms" -Headers $H -ContentType 'application/json' -Body $realmBody | Out-Null
  Write-Output "Realm '$realm' created"
} catch {
  if ($_.Exception.Response.StatusCode.value__ -eq 409) { Write-Output "Realm '$realm' already exists" } else { throw }
}

# 2) Realm roles
foreach ($r in 'MERCHANT','ADMIN','CUSTOMER') {
  try {
    Invoke-RestMethod -Method Post -Uri "$kc/admin/realms/$realm/roles" -Headers $H -ContentType 'application/json' -Body (@{ name=$r } | ConvertTo-Json) | Out-Null
    Write-Output "Role $r created"
  } catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 409) { Write-Output "Role $r exists" } else { throw }
  }
}

# 3) Public clients
function Ensure-Client($clientId, $port) {
  $existing = Invoke-RestMethod -Method Get -Uri "$kc/admin/realms/$realm/clients?clientId=$clientId" -Headers $H
  $cfg = @{
    clientId=$clientId; enabled=$true; protocol='openid-connect'; publicClient=$true;
    standardFlowEnabled=$true; directAccessGrantsEnabled=$true; implicitFlowEnabled=$false;
    redirectUris=@("http://localhost:$port/*","http://localhost:$port/");
    webOrigins=@("http://localhost:$port","+")
  }
  if ($existing.Count -gt 0) {
    $id = $existing[0].id
    Invoke-RestMethod -Method Put -Uri "$kc/admin/realms/$realm/clients/$id" -Headers $H -ContentType 'application/json' -Body ($cfg | ConvertTo-Json) | Out-Null
    Write-Output "Client $clientId updated"
  } else {
    Invoke-RestMethod -Method Post -Uri "$kc/admin/realms/$realm/clients" -Headers $H -ContentType 'application/json' -Body ($cfg | ConvertTo-Json) | Out-Null
    Write-Output "Client $clientId created"
  }
}
Ensure-Client 'scanny-client' 5173
Ensure-Client 'scanny-admin' 5174

# 4) Test user with password + MERCHANT role
$userBody = @{
  username='testuser'; email='testuser@scanny.local'; enabled=$true; emailVerified=$true;
  firstName='Test'; lastName='User';
  credentials=@(@{ type='password'; value='password'; temporary=$false })
} | ConvertTo-Json -Depth 5
try {
  Invoke-RestMethod -Method Post -Uri "$kc/admin/realms/$realm/users" -Headers $H -ContentType 'application/json' -Body $userBody | Out-Null
  Write-Output 'User testuser created'
} catch {
  if ($_.Exception.Response.StatusCode.value__ -eq 409) { Write-Output 'User testuser exists' } else { throw }
}
$uid = (Invoke-RestMethod -Method Get -Uri "$kc/admin/realms/$realm/users?username=testuser" -Headers $H)[0].id
$role = Invoke-RestMethod -Method Get -Uri "$kc/admin/realms/$realm/roles/MERCHANT" -Headers $H
Invoke-RestMethod -Method Post -Uri "$kc/admin/realms/$realm/users/$uid/role-mappings/realm" -Headers $H -ContentType 'application/json' -Body (@(@{ id=$role.id; name=$role.name }) | ConvertTo-Json) | Out-Null
Write-Output 'MERCHANT role assigned to testuser'

Write-Output 'DONE'
