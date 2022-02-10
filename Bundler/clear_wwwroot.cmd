@echo off
cd "..\"
del /q "%cd%\Arasaki\Client\wwwroot\*"
FOR /D %%p IN ("%cd%\Arasaki\Client\wwwroot\*.*") DO rmdir "%%p" /s /q