param(
  [Parameter(Mandatory = $true)]
  [string]$Payload,

  [Parameter(Mandatory = $true)]
  [string]$Jwt,

  [string]$BaseUrl = "http://localhost:4000",
  [string]$ScannedBy = "Gate Phone 1",
  [string]$ScanLocation = "Main Gate",
  [string]$DeviceInfo = "Android"
)

$uri = "$BaseUrl/api/tickets/scan"
$headers = @{
  Authorization = "Bearer $Jwt"
  "Content-Type" = "application/json"
}

$body = @{
  payload = $Payload
  scannedBy = $ScannedBy
  scanLocation = $ScanLocation
  deviceInfo = $DeviceInfo
} | ConvertTo-Json -Depth 4

Write-Host "POST $uri" -ForegroundColor Cyan
Write-Host "Scanning ticket payload..." -ForegroundColor Cyan

try {
  $response = Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -Body $body
  $response | ConvertTo-Json -Depth 10
} catch {
  if ($_.Exception.Response -and $_.Exception.Response.GetResponseStream()) {
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $errorBody = $reader.ReadToEnd()
    Write-Host "Request failed:" -ForegroundColor Red
    Write-Output $errorBody
  } else {
    throw
  }
}
