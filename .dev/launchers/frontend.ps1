$Host.UI.RawUI.WindowTitle = 'Kode Frontend'
Set-Location -LiteralPath 'C:\Users\Alsek\Desktop\scanny'
$env:VITE_DEV_HTTPS = '0'
$env:VITE_API_BASE_URL = 'http://192.168.1.7:4000/api'
$env:VITE_SCAN_BASE_URL = 'http://192.168.1.7:5173'
$env:VITE_WS_BASE_URL = 'ws://192.168.1.7:4000'
$env:VITE_KEYCLOAK_URL = 'http://localhost:8080'
npm run dev -- --host 0.0.0.0 --port 5173
