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

:: Mở trình duyệt sau 2 giây để đảm bảo server đã kịp khởi động
timeout /t 2 /nobreak >nul
start "" http://localhost:8000

:: Chạy server trực tiếp trong thư mục hiện tại đã được cd ở trên
python -m http.server 8000

echo.
echo Server stopped.
pause