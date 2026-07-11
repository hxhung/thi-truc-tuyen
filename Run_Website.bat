@echo off
title Local Website Server
color 0A

cd /d "%~dp0"

echo ==========================================
echo        LOCAL WEBSITE SERVER
echo ==========================================
echo.

:: Kiểm tra Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python chua duoc cai hoac chua them vao PATH.
    echo.
    pause
    exit /b
)

echo Starting server...
echo.

start "" http://localhost:8000

python -m http.server 8000

echo.
echo Server stopped.
pause