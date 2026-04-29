@echo off
cd /d "D:\game evaluation\game evaluation"
echo 正在关闭旧的服务进程（如有）...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr /c:"LISTENING"') do (
  if not "%%a"=="0" taskkill /f /pid %%a >nul 2>nul
)
timeout /t 1 /nobreak >nul
echo 正在启动游戏评分网站...
"C:\Program Files\nodejs\node" server.js
pause
