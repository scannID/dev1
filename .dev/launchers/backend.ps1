$Host.UI.RawUI.WindowTitle = 'Kode Backend'
Set-Location -LiteralPath 'C:\Users\Alsek\Desktop\scanny\backend'
$env:JAVA_HOME = 'C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot'
$env:Path = "$env:JAVA_HOME\bin;C:\Users\Alsek\tools\apache-maven-3.9.9\bin;$env:Path"
$env:SCAN_BASE_URL = 'http://192.168.1.6:5173'
$env:PEXELS_API_KEY = 'VfC9HAtMzIDWwfcdiwdwLH9H0a4F12VqyhToF1I9S1Q8oKWL9JJMtRrv'
$env:WHATSAPP_ENABLED = 'true'
$env:WHATSAPP_API_URL = 'https://graph.facebook.com/v25.0/1280824211772871/messages'
$env:WHATSAPP_API_TOKEN = 'EAAO2JPrtuPwBSIn0CyM6WP3W6CZC18gK0CBmeVMhGCPDQjbGaAEiFxZA0ZCRmI9YvGBQk4l8L9RmK3O1c4jpXMlJ4TF42PIJ84zM7JuIMbEMw53XypesSFlbcxSdjAJhA1sCvIguL0oUjy7gDMJwYNLovWh0xZBVsEgTTQLPQsNtOXRKV44AEmmwhrv3fNThnh936ZCryU69qqTIeAmVbyzZBiOZBHTyWMhj3jLQm7niVMloksZB7nY2FMX2QwkRnrjUsP0BjLsWnLh3pZCXMZC9B7'
$env:WHATSAPP_FROM_NUMBER = ''
.\mvnw.cmd -q -DskipTests spring-boot:run "-Dspring-boot.run.profiles=h2"
