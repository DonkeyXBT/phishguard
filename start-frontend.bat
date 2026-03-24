@echo off
cd /d "%~dp0frontend\admin"

if not exist "node_modules" (
    echo [PhishGuard] Installing frontend dependencies...
    npm install
)

echo.
echo [PhishGuard] Admin dashboard starting on http://localhost:5173
echo [PhishGuard] Press Ctrl+C to stop.
echo.
npm run dev
