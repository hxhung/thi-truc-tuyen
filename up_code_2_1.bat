@echo off
setlocal EnableExtensions EnableDelayedExpansion

title Ultimate Git Manager v2.1

color 0A

::====================================================
:: Ultimate Git Manager v2.1
:: Ban sua loi: parse URL (SSH/HTTPS), ahead/behind,
::              GitHub Pages, sync branch, dead labels,
::              logic commit bi dao nguoc.
::====================================================

:BOOT

cls

echo.
echo ===============================================================
echo               ULTIMATE GIT MANAGER v2.1
echo ===============================================================
echo.

::----------------------------------------------------
:: Check Git
::----------------------------------------------------

where git >nul 2>nul

if errorlevel 1 (
    color 0C
    echo.
    echo [ERROR]
    echo.
    echo Git chua duoc cai dat.
    echo.
    echo https://git-scm.com/download/win
    echo.
    pause
    exit
)

::----------------------------------------------------
:: Check Repository
::----------------------------------------------------

git rev-parse --is-inside-work-tree >nul 2>nul

if errorlevel 1 (

    color 0C

    echo.
    echo Day khong phai Git Repository.
    echo.

    echo Thu muc:
    echo %CD%
    echo.

    echo Hay clone hoac git init truoc.
    echo.

    pause
    exit
)

::----------------------------------------------------
:: Read Current Branch
::----------------------------------------------------

set "CURRENT_BRANCH="

for /f "delims=" %%i in ('git branch --show-current') do (
    set "CURRENT_BRANCH=%%i"
)

if "%CURRENT_BRANCH%"=="" (
    set "CURRENT_BRANCH=HEAD"
)

::----------------------------------------------------
:: Read Remote URL
::----------------------------------------------------

set "REMOTE_URL="

for /f "delims=" %%i in ('git remote get-url origin 2^>nul') do (
    set "REMOTE_URL=%%i"
)

if "%REMOTE_URL%"=="" (

    color 0E

    echo.
    echo Repository chua co Remote Origin.
    echo.

    pause
    exit
)

::----------------------------------------------------
:: Parse Repository Name / GitHub User / Host
:: (thong nhat cho ca HTTPS, HTTP, SSH dang scp va SSH dang URL)
::----------------------------------------------------

call :PARSE_REMOTE "%REMOTE_URL%"

::----------------------------------------------------
:: Current Commit
::----------------------------------------------------

set "LAST_COMMIT="

for /f "delims=" %%i in ('git log -1 --pretty^=%%s 2^>nul') do (
    set "LAST_COMMIT=%%i"
)

if "%LAST_COMMIT%"=="" (
    set "LAST_COMMIT=(No Commit)"
)

::----------------------------------------------------
:: Count Modified Files
::----------------------------------------------------

set "MODIFIED=0"

for /f %%i in ('git status --porcelain ^| find /c /v ""') do (
    set "MODIFIED=%%i"
)

::----------------------------------------------------
:: Internet Check
::----------------------------------------------------

ping github.com -n 1 >nul

if errorlevel 1 (
    set "INTERNET=Offline"
) else (
    set "INTERNET=Online"
)

::----------------------------------------------------
:: Ahead / Behind
:: FIX: truoc day dung 2 vong for /f rieng, vong dau
:: chi lay duoc token dau tien cua dong ket qua nen so
:: AHEAD bi mat. Gio lay truc tiep tokens 1,2 tu lenh git.
::----------------------------------------------------

git fetch origin >nul 2>nul

set "AHEAD=0"
set "BEHIND=0"

for /f "tokens=1,2" %%a in ('git rev-list --left-right --count origin/%CURRENT_BRANCH%...HEAD 2^>nul') do (
    set "BEHIND=%%a"
    set "AHEAD=%%b"
)

::----------------------------------------------------
:: Dashboard
::----------------------------------------------------

:DASHBOARD

cls

color 0A

echo ===============================================================
echo                 Ultimate Git Manager v2.1
echo ===============================================================
echo.

echo Repository : %REPO_NAME%
echo User       : %GITHUB_USER%
echo Host       : %GITHUB_HOST%
echo Branch     : %CURRENT_BRANCH%
echo.

echo Remote
echo %REMOTE_URL%
echo.

echo Internet   : %INTERNET%

echo Modified   : %MODIFIED%

echo Ahead      : %AHEAD%

echo Behind     : %BEHIND%
echo.

echo Last Commit
echo %LAST_COMMIT%
echo.

echo ---------------------------------------------------------------
echo.

echo  1. Upload Code
echo  2. Pull
echo  3. Fetch
echo  4. Status
echo  5. Commit History
echo  6. Rollback Last Commit
echo  7. Open GitHub Repository
echo  8. Open GitHub Pages
echo  9. Create Tag
echo 10. Switch Branch
echo 11. Create Branch
echo 12. Merge Branch
echo 13. Sync All Branches
echo 14. Git Cleanup
echo 15. Refresh
echo 16. More Tools
echo 17. Exit
echo.

set "MENU="
set /p MENU=Select:

if "%MENU%"=="1" goto UPLOAD

if "%MENU%"=="2" goto PULL

if "%MENU%"=="3" goto FETCH

if "%MENU%"=="4" goto STATUS

if "%MENU%"=="5" goto HISTORY

if "%MENU%"=="6" goto ROLLBACK

if "%MENU%"=="7" goto OPEN_REPO

if "%MENU%"=="8" goto OPEN_PAGE

if "%MENU%"=="9" goto TAG

if "%MENU%"=="10" goto SWITCH

if "%MENU%"=="11" goto NEW_BRANCH

if "%MENU%"=="12" goto MERGE

if "%MENU%"=="13" goto SYNC

if "%MENU%"=="14" goto CLEAN

if "%MENU%"=="15" goto BOOT

if "%MENU%"=="16" goto MORE_MENU

if "%MENU%"=="17" goto EXIT

goto UNKNOWN
::====================================================
:: UPLOAD
::====================================================

:UPLOAD

cls

echo.
echo ============================================
echo             UPLOAD CODE
echo ============================================
echo.

git status

echo.

set "MSG="

set /p MSG=Commit Message :

if "%MSG%"=="" (
    set "MSG=Update"
)

echo.
echo Adding files...
git add .

if errorlevel 1 (
    color 0C
    echo.
    echo Add that bai.
    pause
    goto DASHBOARD
)

echo.
echo Creating Commit...

git diff --cached --quiet

if errorlevel 1 (
    rem errorlevel 1 nghia la CO thay doi da staged -> tao commit
    git commit -m "%MSG%"
) else (
    rem errorlevel 0 nghia la KHONG co thay doi -> khong commit
    echo.
    echo Khong co thay doi de commit.
)

echo.
echo Uploading...

git push origin %CURRENT_BRANCH%

if errorlevel 1 (

    color 0E

    echo.
    echo Push that bai.
    echo.

    choice /M "Force Push"

    if errorlevel 2 goto DASHBOARD

    git push origin %CURRENT_BRANCH% --force

    if errorlevel 1 (
        color 0C
        echo.
        echo Force Push that bai.
        pause
        goto DASHBOARD
    )
)

color 0A

echo.
echo ============================================
echo Upload thanh cong.
echo ============================================

pause

goto BOOT

::====================================================
:: PULL
::====================================================

:PULL

cls

echo.
echo ============================================
echo Pull tu GitHub
echo ============================================

echo.

git pull origin %CURRENT_BRANCH%

echo.

pause

goto BOOT

::====================================================
:: FETCH
::====================================================

:FETCH

cls

echo.
echo ============================================
echo Fetch
echo ============================================

echo.

git fetch --all

echo.

pause

goto BOOT

::====================================================
:: STATUS
::====================================================

:STATUS

cls

echo.
echo ============================================
echo Git Status
echo ============================================

echo.

git status

echo.

pause

goto DASHBOARD

::====================================================
:: HISTORY
::====================================================

:HISTORY

cls

echo.
echo ============================================
echo Commit History
echo ============================================

echo.

git log --graph --decorate --oneline --all -20

echo.

pause

goto DASHBOARD

::====================================================
:: ROLLBACK
::====================================================

:ROLLBACK

cls

color 0E

echo.
echo ============================================
echo Rollback Last Commit
echo ============================================

echo.

choice /M "Ban chac chan"

if errorlevel 2 goto DASHBOARD

git reset --soft HEAD~1

echo.

echo Da rollback commit gan nhat.

pause

goto BOOT

::====================================================
:: OPEN REPOSITORY
:: FIX: khong dung truc tiep REMOTE_URL (co the la dang
:: SSH git@host:owner/repo.git khong mo duoc tren trinh
:: duyet). Dung GITHUB_HOST/GITHUB_USER/REPO_NAME da
:: parse chuan de dung URL https:// hop le.
::====================================================

:OPEN_REPO

cls

if "%GITHUB_USER%"=="" (
    color 0C
    echo.
    echo Khong xac dinh duoc thong tin tu Remote URL.
    echo.
    pause
    goto DASHBOARD
)

start "" "https://%GITHUB_HOST%/%GITHUB_USER%/%REPO_NAME%"

goto DASHBOARD

::====================================================
:: OPEN GITHUB PAGE
:: FIX: truoc day dung string-replace cung nhac (chi
:: dung voi dung dinh dang https://github.com/...).
:: Gio dung GITHUB_USER/REPO_NAME da parse thong nhat,
:: hoat dong voi ca URL dang HTTPS lan SSH.
::====================================================

:OPEN_PAGE

cls

if "%GITHUB_USER%"=="" (
    color 0C
    echo.
    echo Khong xac dinh duoc thong tin GitHub tu Remote URL.
    echo.
    pause
    goto DASHBOARD
)

start "" "https://%GITHUB_USER%.github.io/%REPO_NAME%/"

goto DASHBOARD

::====================================================
:: CREATE TAG
::====================================================

:TAG

cls

echo.
echo ============================================
echo               CREATE TAG
echo ============================================
echo.

set "TAGNAME="
set /p TAGNAME=Tag Name :

if "%TAGNAME%"=="" (
    goto DASHBOARD
)

git tag %TAGNAME%

if errorlevel 1 (
    color 0C
    echo.
    echo Khong tao duoc Tag.
    pause
    goto DASHBOARD
)

git push origin %TAGNAME%

echo.
echo Tag da tao thanh cong.

pause

goto BOOT

::====================================================
:: SWITCH BRANCH
::====================================================

:SWITCH

cls

echo.
echo ============================================
echo             SWITCH BRANCH
echo ============================================
echo.

git branch

echo.

set "BR="

set /p BR=Branch :

if "%BR%"=="" goto DASHBOARD

git checkout %BR%

if errorlevel 1 (
    color 0C
    echo.
    echo Khong chuyen duoc Branch.
    pause
    goto DASHBOARD
)

goto BOOT

::====================================================
:: CREATE NEW BRANCH
::====================================================

:NEW_BRANCH

cls

echo.
echo ============================================
echo             CREATE BRANCH
echo ============================================
echo.

set "NEWBR="

set /p NEWBR=New Branch :

if "%NEWBR%"=="" goto DASHBOARD

git checkout -b %NEWBR%

if errorlevel 1 (
    color 0C
    echo.
    echo Tao Branch that bai.
    pause
    goto DASHBOARD
)

git push -u origin %NEWBR%

echo.
echo Hoan tat.

pause

goto BOOT

::====================================================
:: MERGE BRANCH
::====================================================

:MERGE

cls

echo.
echo ============================================
echo              MERGE BRANCH
echo ============================================
echo.

git branch

echo.

set "MERGEBR="

set /p MERGEBR=Merge Branch :

if "%MERGEBR%"=="" goto DASHBOARD

git merge %MERGEBR%

if errorlevel 1 (

    color 0E

    echo.
    echo Co Conflict hoac Merge that bai.
    pause

    goto DASHBOARD
)

git push origin %CURRENT_BRANCH%

echo.
echo Merge hoan tat.

pause

goto BOOT

::====================================================
:: SYNC ALL BRANCHES
:: FIX: "git pull --all" khong phai lenh chinh thuc phu
:: hop cho muc dich nay. Thay bang: fetch --all --prune,
:: sau do duyet tung local branch co upstream va fast-
:: forward rieng biet, cuoi cung quay ve branch ban dau.
::====================================================

:SYNC

cls

echo.
echo ============================================
echo            SYNC ALL BRANCH
echo ============================================
echo.

git fetch --all --prune

echo.
echo Dang cap nhat cac branch local co theo doi remote...
echo.

for /f "delims=" %%b in ('git for-each-ref --format^="%%(refname:short)" refs/heads/') do (
    call :SYNC_ONE_BRANCH "%%b"
)

git checkout --quiet %CURRENT_BRANCH% >nul 2>nul

echo.

echo Dong bo hoan tat.

pause

goto BOOT

:SYNC_ONE_BRANCH

set "SB=%~1"

git rev-parse --abbrev-ref %SB%@{upstream} >nul 2>nul

if errorlevel 1 (
    echo   [%SB%] Khong co upstream, bo qua.
    goto :EOF
)

echo   Dang cap nhat %SB% ...

git checkout --quiet %SB%

git merge --ff-only @{upstream} >nul 2>nul

if errorlevel 1 (
    echo   [%SB%] Khong the fast-forward ^(co the co xung dot^), bo qua.
)

goto :EOF

::====================================================
:: CLEAN
::====================================================

:CLEAN

cls

echo.
echo ============================================
echo              GIT CLEANUP
echo ============================================
echo.

git gc

git prune

git reflog expire --expire=now --all

echo.

echo Cleanup hoan tat.

pause

goto BOOT

::====================================================
:: LOG FILE
::====================================================

:WRITE_LOG

echo -------------------------------------------->>up_code.log
echo %date% %time%>>up_code.log
echo Repository : %REPO_NAME%>>up_code.log
echo Branch     : %CURRENT_BRANCH%>>up_code.log
echo Commit     : %LAST_COMMIT%>>up_code.log
echo User       : %GITHUB_USER%>>up_code.log
echo -------------------------------------------->>up_code.log

goto :EOF

::====================================================
:: REFRESH
::====================================================

:REFRESH

call :WRITE_LOG

goto BOOT

::====================================================
:: UNKNOWN OPTION
::====================================================

:UNKNOWN

echo.
echo Lua chon khong hop le.

timeout /t 1 >nul

goto DASHBOARD

::====================================================
:: MORE TOOLS MENU
:: FIX: cac nhan ben duoi (CHECK_UPDATE, STASH_*,
:: REMOTE_INFO, CONFIG, SHOW_BRANCH, DELETE_BRANCH,
:: DELETE_REMOTE_BRANCH, CLONE, OPEN_FOLDER, OPEN_CMD,
:: VERSION, ABOUT) truoc day khong duoc menu chinh goi
:: toi (dead code). Gio duoc gan vao menu con nay.
::====================================================

:MORE_MENU

cls

echo.
echo ===============================================================
echo                       MORE TOOLS
echo ===============================================================
echo.

echo  1. Check Update (xem commit moi tren remote)
echo  2. Stash Save
echo  3. Stash Apply
echo  4. Stash Drop
echo  5. Remote Info
echo  6. Git Config
echo  7. Show All Branches
echo  8. Delete Local Branch
echo  9. Delete Remote Branch
echo 10. Clone Project
echo 11. Open Project Folder
echo 12. Open CMD Here
echo 13. Version
echo 14. About
echo 15. Back
echo.

set "MENU2="
set /p MENU2=Select:

if "%MENU2%"=="1" goto CHECK_UPDATE
if "%MENU2%"=="2" goto STASH_SAVE
if "%MENU2%"=="3" goto STASH_APPLY
if "%MENU2%"=="4" goto STASH_DROP
if "%MENU2%"=="5" goto REMOTE_INFO
if "%MENU2%"=="6" goto CONFIG
if "%MENU2%"=="7" goto SHOW_BRANCH
if "%MENU2%"=="8" goto DELETE_BRANCH
if "%MENU2%"=="9" goto DELETE_REMOTE_BRANCH
if "%MENU2%"=="10" goto CLONE
if "%MENU2%"=="11" goto OPEN_FOLDER
if "%MENU2%"=="12" goto OPEN_CMD
if "%MENU2%"=="13" goto VERSION
if "%MENU2%"=="14" goto ABOUT
if "%MENU2%"=="15" goto DASHBOARD

goto UNKNOWN

::====================================================
:: CHECK UPDATE
::====================================================

:CHECK_UPDATE

cls

echo.
echo ============================================
echo          CHECK UPDATE
echo ============================================
echo.

echo Fetching...

git fetch origin

echo.

echo Commit tren GitHub:
echo.

git log HEAD..origin/%CURRENT_BRANCH% --oneline

echo.

pause

goto MORE_MENU

::====================================================
:: STASH SAVE
::====================================================

:STASH_SAVE

cls

echo.
echo ============================================
echo           STASH SAVE
echo ============================================
echo.

git stash push -u

echo.

git stash list

echo.

pause

goto MORE_MENU

::====================================================
:: STASH APPLY
::====================================================

:STASH_APPLY

cls

echo.
echo ============================================
echo          STASH APPLY
echo ============================================
echo.

git stash list

echo.

set "STASHID="

set /p STASHID=Nhap stash (vd stash@{0}) :

if "%STASHID%"=="" goto MORE_MENU

git stash apply %STASHID%

echo.

pause

goto MORE_MENU

::====================================================
:: DELETE STASH
::====================================================

:STASH_DROP

cls

echo.
echo ============================================
echo          DELETE STASH
echo ============================================
echo.

git stash list

echo.

set "STASHID="

set /p STASHID=Nhap stash :

if "%STASHID%"=="" goto MORE_MENU

git stash drop %STASHID%

echo.

pause

goto MORE_MENU

::====================================================
:: SHOW REMOTE
::====================================================

:REMOTE_INFO

cls

echo.
echo ============================================
echo          REMOTE INFO
echo ============================================
echo.

git remote -v

echo.

git remote show origin

echo.

pause

goto MORE_MENU

::====================================================
:: SHOW CONFIG
::====================================================

:CONFIG

cls

echo.
echo ============================================
echo          GIT CONFIG
echo ============================================
echo.

git config --list

echo.

pause

goto MORE_MENU

::====================================================
:: SHOW BRANCHES
::====================================================

:SHOW_BRANCH

cls

echo.
echo ============================================
echo          ALL BRANCHES
echo ============================================
echo.

git branch -a

echo.

pause

goto MORE_MENU

::====================================================
:: DELETE LOCAL BRANCH
::====================================================

:DELETE_BRANCH

cls

echo.
echo ============================================
echo       DELETE LOCAL BRANCH
echo ============================================
echo.

git branch

echo.

set "DELBR="

set /p DELBR=Branch :

if "%DELBR%"=="" goto MORE_MENU

git branch -d %DELBR%

echo.

pause

goto BOOT

::====================================================
:: DELETE REMOTE BRANCH
::====================================================

:DELETE_REMOTE_BRANCH

cls

echo.
echo ============================================
echo      DELETE REMOTE BRANCH
echo ============================================
echo.

git branch -r

echo.

set "DELREMOTE="

set /p DELREMOTE=Remote Branch :

if "%DELREMOTE%"=="" goto MORE_MENU

git push origin --delete %DELREMOTE%

echo.

pause

goto BOOT

::====================================================
:: CLONE
::====================================================

:CLONE

cls

echo.
echo ============================================
echo          CLONE PROJECT
echo ============================================
echo.

set "URL="

set /p URL=Repository URL :

if "%URL%"=="" goto MORE_MENU

set "FOLDER="

set /p FOLDER=Folder :

if "%FOLDER%"=="" (
    git clone %URL%
) else (
    git clone %URL% %FOLDER%
)

echo.

pause

goto MORE_MENU

::====================================================
:: OPEN PROJECT
::====================================================

:OPEN_FOLDER

start "" "%CD%"

goto MORE_MENU

::====================================================
:: OPEN CMD
::====================================================

:OPEN_CMD

start cmd.exe /k cd /d "%CD%"

goto MORE_MENU

::====================================================
:: VERSION
::====================================================

:VERSION

cls

echo.
echo ============================================
echo            VERSION
echo ============================================
echo.

git --version

echo.

pause

goto MORE_MENU

::====================================================
:: ABOUT
::====================================================

:ABOUT

cls

echo.
echo ============================================
echo     ULTIMATE GIT MANAGER V2.1
echo ============================================
echo.

echo Features
echo.
echo - Auto Detect Repository
echo - Auto Detect Branch
echo - Upload
echo - Pull
echo - Fetch
echo - Status
echo - History
echo - Rollback
echo - Tag
echo - Branch
echo - Merge
echo - Sync
echo - Cleanup
echo - Stash
echo - Remote
echo - Config
echo - Clone
echo - GitHub
echo - GitHub Pages
echo.

pause

goto MORE_MENU

::====================================================
:: PARSE REMOTE URL
:: Thong nhat xu ly ca:
::   - https://github.com/user/repo.git
::   - http://github.com/user/repo.git
::   - ssh://git@github.com/user/repo.git
::   - git@github.com:user/repo.git   (dang scp)
:: Ket qua: GITHUB_HOST, GITHUB_USER, REPO_NAME
::====================================================

:PARSE_REMOTE

set "GITHUB_HOST="
set "GITHUB_USER="
set "REPO_NAME="
set "_URL=%~1"

if not defined _URL goto :EOF

rem --- Bo dau "/" cuoi chuoi neu co ---
if "!_URL:~-1!"=="/" set "_URL=!_URL:~0,-1!"

rem --- Bo duoi ".git" (khong phan biet hoa/thuong) ---
set "_EXT=!_URL:~-4!"
if /i "!_EXT!"==".git" set "_URL=!_URL:~0,-4!"

rem --- Xac dinh dang URL (co "://") hay dang scp (git@host:owner/repo) ---
set "_ISURL=0"
echo(!_URL!| findstr /C:"://" >nul
if !errorlevel! equ 0 set "_ISURL=1"

if "!_ISURL!"=="1" (
    rem Bo phan giao thuc (https://, http://, ssh://)
    set "_REST=!_URL:*://=!"
    rem Neu con dang user@host (vd git@github.com) thi bo tiep user@
    echo(!_REST!| findstr /C:"@" >nul
    if !errorlevel! equ 0 set "_REST=!_REST:*@=!"
) else (
    rem Dang scp: git@github.com:owner/repo -> bo "git@"
    set "_REST=!_URL!"
    echo(!_REST!| findstr /C:"@" >nul
    if !errorlevel! equ 0 set "_REST=!_REST:*@=!"
    rem Doi dau ":" thanh "/" de dua ve cung dinh dang host/owner/repo
    set "_REST=!_REST::=/!"
)

rem --- Tach host / owner / repo tu "host/owner/repo" ---
for /f "tokens=1,2,3 delims=/" %%a in ("!_REST!") do (
    set "GITHUB_HOST=%%a"
    set "GITHUB_USER=%%b"
    set "REPO_NAME=%%c"
)

goto :EOF

::====================================================
:: EXIT
::====================================================

:EXIT

cls

echo.

echo Cam on ban da su dung.

timeout /t 2 >nul

exit