$Host.UI.RawUI.WindowTitle = 'Scanny Backend'
Set-Location -LiteralPath 'C:\Users\Alsek\Desktop\scanny\backend'
$env:JAVA_HOME = 'C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot'
$env:Path = "$env:JAVA_HOME\bin;C:\Users\Alsek\tools\apache-maven-3.9.9\bin;$env:Path"
$env:SCAN_BASE_URL = 'http://192.168.1.3:5173'
.\mvnw.cmd -q -DskipTests spring-boot:run "-Dspring-boot.run.profiles=h2"
