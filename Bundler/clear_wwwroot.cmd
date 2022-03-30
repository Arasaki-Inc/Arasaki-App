@echo off
cd "..\"
del /q "%cd%\OS\wwwroot\*"
FOR /D %%p IN ("%cd%\OS\wwwroot\*.*") DO rmdir "%%p" /s /q