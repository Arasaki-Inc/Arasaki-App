@echo off
cd "Bundler"
start cmd /c npm i
cd "..\Arasaki\Client\wwwroot-dev"
start cmd /c npm i
exit