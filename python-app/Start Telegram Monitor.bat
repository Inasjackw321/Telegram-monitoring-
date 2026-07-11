@echo off
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo Setting up Telegram Live Monitor for the first time - this can take a minute...
    python -m venv .venv
    if errorlevel 1 (
        echo.
        echo Could not find Python. Install Python 3.9+ from https://python.org
        echo ^(make sure "Add python.exe to PATH" is checked during install^), then run this again.
        pause
        exit /b 1
    )
    ".venv\Scripts\python.exe" -m pip install --upgrade pip >nul
    ".venv\Scripts\pip.exe" install -r requirements.txt
    if errorlevel 1 (
        echo.
        echo Failed to install dependencies - see the error above.
        pause
        exit /b 1
    )
    echo Setup complete.
    echo.
)

echo Starting Telegram Live Monitor...
echo (First run ever: watch here for a Telegram login prompt - phone number, code, 2FA password.)
echo.
".venv\Scripts\python.exe" app.py

if errorlevel 1 (
    echo.
    echo The app exited with an error - see above.
)
echo.
pause
