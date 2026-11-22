@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Akilli Defter PWA baslatiliyor...
echo Tarayici acildiginda adres cubugundan "Uygulama Olarak Yukle" diyerek masaustune kurabilirsiniz.
start "" "http://localhost:4173"
call npm run preview -- --port 4173
pause
