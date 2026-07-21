$Host.UI.RawUI.WindowTitle = 'Scanny Keycloak'
Set-Location -LiteralPath 'C:\Users\Alsek\Desktop\scanny\backend\keycloak-26.0.7\bin'
$env:JAVA_HOME = 'C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot'
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
$env:KC_BOOTSTRAP_ADMIN_USERNAME = 'admin'
$env:KC_BOOTSTRAP_ADMIN_PASSWORD = 'admin'
$env:KEYCLOAK_ADMIN = 'admin'
$env:KEYCLOAK_ADMIN_PASSWORD = 'admin'
.\kc.bat start-dev --http-port=8080
