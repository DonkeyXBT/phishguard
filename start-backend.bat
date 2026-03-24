@echo off
cd /d "%~dp0backend"

echo [PhishGuard] Stopping any existing process on port 8000...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":8000.*LISTENING"') do (
    powershell -Command "Stop-Process -Id %%a -Force -ErrorAction SilentlyContinue"
)
timeout /t 1 /nobreak >nul

if not exist ".venv" (
    echo [PhishGuard] Creating virtual environment...
    python -m venv .venv
    echo [PhishGuard] Installing dependencies...
    .venv\Scripts\pip install -r requirements.txt --quiet
)

echo.
echo [PhishGuard] Backend starting on http://localhost:8000
echo [PhishGuard] API docs: http://localhost:8000/docs
echo [PhishGuard] Press Ctrl+C to stop.
echo.
.venv\Scripts\uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
