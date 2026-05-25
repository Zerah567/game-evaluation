@echo off
cd /d "D:\game evaluation\game evaluation"
echo Killing port 3000...
powershell -Command "Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue|ForEach-Object{Stop-Process -Id $_.OwningProcess -Force}"
echo Done.
timeout /t 1 /nobreak >nul
echo Starting server...
"C:\Program Files\nodejs\node" server.js
pause
