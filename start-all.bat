@echo off
title KJIN Local Development Launcher
echo ===================================================
echo        Starting KJIN Local Development
echo ===================================================
echo.
echo 1. Checking Supabase status...
call supabase status >nul 2>&1
if %errorlevel% neq 0 (
    echo Supabase is not running. Starting local Supabase containers...
    call supabase start
) else (
    echo [OK] Local Supabase is already running.
)

echo.
echo 2. Launching KJIN Admin Portal (http://localhost:3001)...
start "KJIN Admin (:3001)" cmd /k "pnpm dev:admin"

echo.
echo 3. Launching KJIN Website (http://localhost:3000)...
start "KJIN Website (:3000)" cmd /k "pnpm dev:web"

echo.
echo ===================================================
echo [READY] Applications launched in separate windows:
echo - Admin Portal:    http://localhost:3001/
echo - Public Website:  http://localhost:3000/
echo - Supabase Studio: http://localhost:54323/
echo ===================================================
echo You can keep this window open or close it.
pause
