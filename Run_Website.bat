@echo off
title Local Website Server
color 0A

:: Chuyển đến thư mục chứa tệp .bat này một cách tuyệt đối
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

echo Starting server at: %CD%
echo.

:: [MODIFIED 31/07/2026] Đổi port sang 8001 để tránh xung đột với Server Root (8000) và Web Trắc Nghiệm (8002)
start "" http://localhost:8001

:: Chạy server trực tiếp trong thư mục hiện tại đã được cd ở trên
python -m http.server 8001

echo.
echo Server stopped.
pause