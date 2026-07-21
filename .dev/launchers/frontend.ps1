$Host.UI.RawUI.WindowTitle = 'Scanny Frontend'
Set-Location -LiteralPath 'C:\Users\Alsek\Desktop\scanny'
$env:VITE_API_BASE_URL = 'http://192.168.1.3:4000/api'
$env:VITE_SCAN_BASE_URL = 'http://192.168.1.3:5173'
$env:VITE_WS_BASE_URL = 'ws://192.168.1.3:4000'
$env:VITE_KEYCLOAK_URL = 'http://localhost:8080'
npm run dev -- --host 0.0.0.0 --port 5173
