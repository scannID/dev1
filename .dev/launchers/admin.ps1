$Host.UI.RawUI.WindowTitle = 'Kode Admin'
Set-Location -LiteralPath 'C:\Users\Alsek\Desktop\scanny'
$env:VITE_API_BASE_URL = 'http://192.168.1.9:4000/api'
$env:VITE_WS_BASE_URL = 'ws://192.168.1.9:4000'
$env:VITE_KEYCLOAK_URL = 'http://localhost:8080'
$env:VITE_KEYCLOAK_REALM = 'scanny'
$env:VITE_KEYCLOAK_CLIENT_ID = 'scanny-admin'
npm run dev:admin -- --host 0.0.0.0 --port 5174
