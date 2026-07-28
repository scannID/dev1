$Host.UI.RawUI.WindowTitle = 'Kode Backend'
Set-Location -LiteralPath 'C:\Users\Alsek\Desktop\scanny\backend'
$env:JAVA_HOME = 'C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot'
$env:Path = "$env:JAVA_HOME\bin;C:\Users\Alsek\tools\apache-maven-3.9.9\bin;$env:Path"
$env:SCAN_BASE_URL = 'http://192.168.1.9:5173'
$env:PEXELS_API_KEY = 'VfC9HAtMzIDWwfcdiwdwLH9H0a4F12VqyhToF1I9S1Q8oKWL9JJMtRrv'
.\mvnw.cmd -q -DskipTests spring-boot:run "-Dspring-boot.run.profiles=h2"
