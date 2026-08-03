$Host.UI.RawUI.WindowTitle = 'Kode Backend'
Set-Location -LiteralPath 'C:\Users\Alsek\Desktop\scanny\backend'
$env:JAVA_HOME = 'C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot'
$env:Path = "$env:JAVA_HOME\bin;C:\Users\Alsek\tools\apache-maven-3.9.9\bin;$env:Path"
$env:SCAN_BASE_URL = 'http://192.168.1.7:5173'
$env:PEXELS_API_KEY = 'VfC9HAtMzIDWwfcdiwdwLH9H0a4F12VqyhToF1I9S1Q8oKWL9JJMtRrv'
$env:WHATSAPP_ENABLED = 'true'
$env:WHATSAPP_API_URL = 'https://graph.facebook.com/v25.0/1280824211772871/messages'
$env:WHATSAPP_API_TOKEN = 'EAAO2JPrtuPwBSF5YlLs6bNTzaH5XYEq4XTh87ctgwMOb5DsoGQoe2mClX0wjPZB79Fi4mCl99yoYk9yAToZAqIuvAW1WXXCeek1FDE668e5m0kOreM2aRRt8ZA7rKuioyw0QRNyfbV7RoIPghISg4z0eeBN7li5dKHQuOkN12tdUvdUT0Rw3Bi7yIIqVNnDZBsmkWIXcucJumpMNYgfgjaeAzmSFttxhpe8Vgw7tymdPmYWzRug86HDCwcRkNJsSWujuYRB3U4ezSkGZBAkHzFQZDZD'
$env:WHATSAPP_FROM_NUMBER = ''
.\mvnw.cmd -q -DskipTests spring-boot:run "-Dspring-boot.run.profiles=h2"
