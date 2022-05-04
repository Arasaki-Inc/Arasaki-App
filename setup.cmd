@echo off
cd "..\OS\wwwroot-dev"
start cmd /c npm i
start cmd netsh http add urlacl url=http://*:7107/ user=Interactive listen=yes
start cmd netsh advfirewall firewall add rule name="Https Port 7107" dir=in action=allow protocol=TCP localport=7107
exit