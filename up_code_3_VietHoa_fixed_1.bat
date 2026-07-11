@echo off
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion

title Trình Quản lý Git v3.0
color 0A

:: ========================================================
:: TRÌNH QUẢN LÝ GIT v3.0 (Đã sửa lỗi ngày tháng & logic)
:: ========================================================

:BOOT
cls
color 0A
echo.
echo ========================================================
echo           TRÌNH QUẢN LÝ GIT v3.0
echo ========================================================
echo.

:: Kiểm tra Git đã cài đặt chưa
where git >nul 2>nul
if errorlevel 1 (
    color 0C
    echo [LỖI] Git chưa được cài đặt!
    echo Tải tại: https://git-scm.com/download/win
    pause
    exit
)

:: Kiểm tra có đang ở trong thư mục Git repo không
git rev-parse --is-inside-work-tree >nul 2>nul
if errorlevel 1 (
    color 0C
    echo [LỖI] Thư mục này không phải là Kho mã Git.
    echo Đường dẫn: %CD%
    echo Hãy chạy "git init" hoặc clone repository trước.
    pause
    exit
)

call :LOAD_INFO

:DASHBOARD
cls
color 0A
echo ========================================================
echo           TRÌNH QUẢN LÝ GIT v3.0
echo ========================================================
echo.
echo Kho mã     : %REPO_NAME%
echo Người dùng : %GITHUB_USER%
echo Nhánh      : %CURRENT_BRANCH%
echo Internet   : %INTERNET%
echo Đã sửa     : %MODIFIED% tệp
echo Chưa đẩy   : %AHEAD%    Chưa cập nhật: %BEHIND%
echo.
echo Commit gần nhất: %LAST_COMMIT%
echo.
echo --------------------------------------------------------
echo.
echo  1. Đưa mã nguồn lên GitHub (Add + Commit + Push)
echo  2. Tải thay đổi từ GitHub (Pull)
echo  3. Kiểm tra thay đổi trên GitHub (Fetch)
echo  4. Xem trạng thái (Status)
echo  5. Lịch sử Commit
echo  6. Hoàn tác Commit gần nhất (Rollback)
echo  7. Mở Kho mã trên Web
echo  8. Mở GitHub Pages
echo  9. Tạo Tag phiên bản
echo 10. Quản lý Nhánh (Branch)
echo 11. Đồng bộ tất cả Nhánh
echo 12. Dọn dẹp Git (Garbage Collection)
echo 13. Công cụ khác
echo 14. Làm mới (Refresh)
echo 15. Thoát
echo.
set "MENU="
set /p MENU=Chọn chức năng (1-15): 

if "%MENU%"=="1" goto UPLOAD
if "%MENU%"=="2" goto PULL
if "%MENU%"=="3" goto FETCH
if "%MENU%"=="4" goto STATUS
if "%MENU%"=="5" goto HISTORY
if "%MENU%"=="6" goto ROLLBACK
if "%MENU%"=="7" goto OPEN_REPO
if "%MENU%"=="8" goto OPEN_PAGE
if "%MENU%"=="9" goto TAG
if "%MENU%"=="10" goto BRANCH_MENU
if "%MENU%"=="11" goto SYNC
if "%MENU%"=="12" goto CLEAN
if "%MENU%"=="13" goto MORE_MENU
if "%MENU%"=="14" goto BOOT
if "%MENU%"=="15" goto EXIT

echo.
echo Lựa chọn không hợp lệ!
timeout /t 1 >nul
goto DASHBOARD

:: ========================================================
:LOAD_INFO
:: ========================================================
for %%i in (.) do set "PROJECT=%%~nxi"

for /f "delims=" %%i in ('git branch --show-current 2^>nul') do set "CURRENT_BRANCH=%%i"
if "%CURRENT_BRANCH%"=="" set "CURRENT_BRANCH=HEAD"

for /f "delims=" %%i in ('git remote get-url origin 2^>nul') do set "REMOTE_URL=%%i"

call :PARSE_REMOTE "%REMOTE_URL%"

for /f "delims=" %%i in ('git log -1 --pretty^=%%s 2^>nul') do set "LAST_COMMIT=%%i"
if "%LAST_COMMIT%"=="" set "LAST_COMMIT=(Chưa có commit nào)"

for /f %%i in ('git status --porcelain ^| find /c /v ""') do set "MODIFIED=%%i"

ping github.com -n 1 >nul 2>nul
if errorlevel 1 (
    set "INTERNET=Ngoại tuyến"
    set "AHEAD=0" & set "BEHIND=0"
) else (
    set "INTERNET=Trực tuyến"
    git fetch origin >nul 2>nul
    set "AHEAD=0" & set "BEHIND=0"
    for /f "tokens=1,2" %%a in ('git rev-list --left-right --count origin/%CURRENT_BRANCH%...HEAD 2^>nul') do (
        set "BEHIND=%%a"
        set "AHEAD=%%b"
    )
)
exit /b

:: ========================================================
:PARSE_REMOTE
:: ========================================================
set "GITHUB_HOST=" & set "GITHUB_USER=" & set "REPO_NAME="
set "_URL=%~1"
if not defined _URL exit /b

if /i "%_URL:~-4%"==".git" set "_URL=%_URL:~0,-4%"

set "_ISURL=0"
echo %_URL%| findstr /C:"://" >nul && set "_ISURL=1"

if "%_ISURL%"=="1" (
    set "_REST=%_URL:*://=%"
    echo %_REST%| findstr /C:"@" >nul && set "_REST=%_REST:*@=%"
) else (
    set "_REST=%_URL:*@=%"
    set "_REST=%_REST::=/%"
)

for /f "tokens=1,2,3 delims=/" %%a in ("!_REST!") do (
    set "GITHUB_HOST=%%a"
    set "GITHUB_USER=%%b"
    set "REPO_NAME=%%c"
)
exit /b

:: ========================================================
:UPLOAD
:: ========================================================
cls
echo.
echo =============== ĐƯA MÃ NGUỒN LÊN GITHUB ===============
echo.

if "%MODIFIED%"=="0" (
    echo Không có tệp nào thay đổi.
    pause
    goto BOOT
)

git status
echo.
set "MSG="
set /p MSG=Commit message (Enter = tự động cập nhật): 

if "%MSG%"=="" (
    for /f "tokens=2 delims==" %%i in ('wmic os get localdatetime /value') do set "dt=%%i"
    set "MSG=Cập nhật !dt:~0,4!-!dt:~4,2!-!dt:~6,2! !dt:~8,2!:!dt:~10,2!"
)

echo.
echo Đang thêm tệp...
git add .

echo.
echo Đang commit...
git commit -m "%MSG%"

echo.
echo Đang đẩy (push) lên %CURRENT_BRANCH%...
git push origin %CURRENT_BRANCH%

if errorlevel 1 (
    color 0E
    echo.
    echo Push thất bại. Thử force push?
    choice /C YN /M "Force push (khuyến dùng --force-with-lease)?"
    if errorlevel 2 goto BOOT
    git push origin %CURRENT_BRANCH% --force-with-lease
    if errorlevel 1 (
        echo Force push thất bại.
        pause
        goto BOOT
    )
)

color 0A
echo.
echo ========================================
echo        UPLOAD THÀNH CÔNG!
echo ========================================
call :WRITE_LOG "%MSG%"
timeout /t 2 >nul
if not "%GITHUB_USER%"=="" start "" "https://%GITHUB_HOST%/%GITHUB_USER%/%REPO_NAME%"
pause
goto BOOT

:: ========================================================
:WRITE_LOG
:: ========================================================
echo -------------------------------------->>up_code.log
echo %date% %time% >>up_code.log
echo Repo   : %REPO_NAME% >>up_code.log
echo Branch : %CURRENT_BRANCH% >>up_code.log
echo Commit : %~1 >>up_code.log
echo Trạng thái : THÀNH CÔNG >>up_code.log
echo -------------------------------------->>up_code.log
exit /b

:: ========================================================
:PULL
cls
echo.
echo Đang tải thay đổi từ origin/%CURRENT_BRANCH%...
git pull origin %CURRENT_BRANCH%
echo.
pause
goto BOOT

:FETCH
cls
echo.
echo Đang kiểm tra thay đổi trên GitHub...
git fetch --all --prune
echo.
pause
goto BOOT

:STATUS
cls
git status
echo.
pause
goto DASHBOARD

:HISTORY
cls
git log --graph --decorate --oneline -20
echo.
pause
goto DASHBOARD

:ROLLBACK
cls
color 0E
echo.
echo CẢNH BÁO: Hoàn tác (rollback) commit gần nhất (soft reset)
choice /M "Xác nhận rollback?"
if errorlevel 2 goto BOOT
git reset --soft HEAD~1
echo Đã hoàn tác xong.
pause
goto BOOT

:OPEN_REPO
if "%GITHUB_USER%"=="" (
    echo Không thể mở repository. Do chưa cấu hình remote origin.
    pause
    goto DASHBOARD
)
start "" "https://%GITHUB_HOST%/%GITHUB_USER%/%REPO_NAME%"
goto DASHBOARD

:OPEN_PAGE
if "%GITHUB_USER%"=="" (
    echo Không thể mở GitHub Pages.
    pause
    goto DASHBOARD
)
start "" "https://%GITHUB_USER%.github.io/%REPO_NAME%/"
goto DASHBOARD

:TAG
cls
echo.
set "TAGNAME="
set /p TAGNAME=Tên tag: 
if "%TAGNAME%"=="" goto DASHBOARD
git tag %TAGNAME%
git push origin %TAGNAME%
echo Đã tạo và đẩy tag thành công.
pause
goto BOOT

:BRANCH_MENU
cls
echo.
echo === QUẢN LÝ NHÁNH (BRANCH) ===
echo 1. Chuyển nhánh (Switch)
echo 2. Tạo nhánh mới
echo 3. Gộp nhánh (Merge)
echo 4. Xóa nhánh cục bộ (Local)
echo 5. Xóa nhánh từ xa (Remote)
echo 6. Quay lại
set "BM="
set /p BM=Chọn: 
if "%BM%"=="1" goto SWITCH
if "%BM%"=="2" goto NEW_BRANCH
if "%BM%"=="3" goto MERGE
if "%BM%"=="4" goto DELETE_BRANCH
if "%BM%"=="5" goto DELETE_REMOTE_BRANCH
if "%BM%"=="6" goto DASHBOARD
goto BRANCH_MENU

:SWITCH
cls
git branch
echo.
set "BR="
set /p BR=Tên nhánh: 
if "%BR%"=="" goto BRANCH_MENU
git checkout "%BR%"
pause
goto BOOT

:NEW_BRANCH
cls
set "NEWBR="
set /p NEWBR=Tên nhánh mới: 
if "%NEWBR%"=="" goto BRANCH_MENU
git checkout -b "%NEWBR%"
git push -u origin "%NEWBR%"
pause
goto BOOT

:MERGE
cls
git branch
echo.
set "MERGEBR="
set /p MERGEBR=Gộp từ nhánh: 
if "%MERGEBR%"=="" goto BRANCH_MENU
git merge "%MERGEBR%"
pause
goto BOOT

:DELETE_BRANCH
cls
git branch
echo.
set "DELBR="
set /p DELBR=Xóa nhánh: 
if "%DELBR%"=="" goto BRANCH_MENU
git branch -d "%DELBR%"
pause
goto BOOT

:DELETE_REMOTE_BRANCH
cls
git branch -r
echo.
set "DELREM="
set /p DELREM=Nhánh từ xa cần xóa: 
if "%DELREM%"=="" goto BRANCH_MENU
git push origin --delete "%DELREM%"
pause
goto BOOT

:SYNC
cls
echo Đang đồng bộ tất cả nhánh...
git fetch --all --prune
for /f "delims=" %%b in ('git for-each-ref --format="%%(refname:short)" refs/heads/') do (
    git rev-parse --abbrev-ref %%b@{upstream} >nul 2>nul
    if errorlevel 1 (
        echo [Bỏ qua] Nhánh %%b không có nhánh tương ứng trên Remote (No upstream).
    ) else (
        git checkout --quiet %%b
        git merge --ff-only @{upstream} >nul 2>nul
        if errorlevel 1 echo [Thất bại] Nhánh %%b không thể Fast-Forward.
    )
)
git checkout --quiet %CURRENT_BRANCH%
echo Đồng bộ hoàn tất.
pause
goto BOOT

:CLEAN
cls
echo Đang dọn dẹp Git...
git gc --aggressive
echo Dọn dẹp hoàn tất.
pause
goto BOOT

:MORE_MENU
cls
echo.
echo ================= CÔNG CỤ KHÁC =================
echo  1. Lưu tạm (Stash Save)
echo  2. Áp dụng Stash (Stash Apply)
echo  3. Xóa Stash (Stash Drop)
echo  4. Thông tin Remote
echo  5. Cấu hình Git (Config)
echo  6. Hiển thị tất cả Nhánh
echo  7. Kiểm tra cập nhật mới
echo  8. Mở thư mục dự án
echo  9. Mở CMD tại đây
echo 10. Giới thiệu
echo 11. Quay lại
echo.
set "M2="
set /p M2=Chọn: 

if "%M2%"=="1" git stash push -u && pause && goto MORE_MENU
if "%M2%"=="2" (
    git stash list
    set "SID="
    set /p SID=Mã Stash: 
    git stash apply %SID%
    pause
    goto MORE_MENU
)
if "%M2%"=="3" (
    git stash list
    set "SID="
    set /p SID=Mã Stash: 
    git stash drop %SID%
    pause
    goto MORE_MENU
)
if "%M2%"=="4" git remote -v && git remote show origin && pause && goto MORE_MENU
if "%M2%"=="5" git config --list && pause && goto MORE_MENU
if "%M2%"=="6" git branch -a && pause && goto MORE_MENU
if "%M2%"=="7" (
    git fetch origin
    git log HEAD..origin/%CURRENT_BRANCH% --oneline
    pause
    goto MORE_MENU
)
if "%M2%"=="8" start "" "%CD%" && goto MORE_MENU
if "%M2%"=="9" start cmd.exe /k cd /d "%CD%" && goto MORE_MENU
if "%M2%"=="10" goto ABOUT
if "%M2%"=="11" goto DASHBOARD
goto MORE_MENU

:ABOUT
cls
echo.
echo Trình Quản lý Git v3.0
echo Kết hợp các tính năng tốt nhất từ những phiên bản trước.
echo Đã cải tiến giao diện, ghi log, phân tích remote và trải nghiệm sử dụng.
echo Đã Việt hóa toàn bộ và sửa lỗi hiển thị tiếng Việt (UTF-8).
echo.
pause
goto MORE_MENU

:EXIT
cls
echo.
echo Cảm ơn bạn đã sử dụng Trình Quản lý Git v3.0!
timeout /t 2 >nul
exit