@echo off
echo [PhishGuard] Running first-time setup...
echo [PhishGuard] Make sure the backend is running first (start-backend.bat)
echo.
curl -s -X POST http://localhost:8000/api/auth/setup
echo.
echo [PhishGuard] Done. Login with admin@company.com / admin123
pause
