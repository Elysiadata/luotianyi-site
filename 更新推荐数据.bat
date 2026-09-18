@echo off
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
    echo.
    echo  [ERROR] Python not found in PATH.
    echo  Please install Python 3.9+ and check "Add Python to PATH".
    echo.
    pause
    exit /b 1
)

python sync-data.py
echo.
pause
