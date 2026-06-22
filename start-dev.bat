@echo off
setlocal EnableExtensions
title Photo Memory Starter

set "ROOT=%~dp0"
set "SCRIPT=%ROOT%start-dev.ps1"

cd /d "%ROOT%" 2>nul
if errorlevel 1 (
  echo.
  echo [ERROR] Cannot enter project directory:
  echo %ROOT%
  echo.
  echo Please move the project to a normal local path, then run this file again.
  echo.
  pause
  exit /b 1
)

echo.
echo ========================================
echo   Photo Memory startup wrapper
echo ========================================
echo Project: %CD%
echo.

if not exist "%SCRIPT%" (
  echo [ERROR] start-dev.ps1 was not found.
  echo The project files may be incomplete. Please download or clone the project again.
  echo.
  pause
  exit /b 1
)

where powershell.exe >nul 2>nul
if errorlevel 1 (
  echo [ERROR] powershell.exe was not found.
  echo Please use Windows 10/11 or enable Windows PowerShell.
  echo.
  pause
  exit /b 1
)

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" %*
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if not "%EXIT_CODE%"=="0" (
  echo ========================================
  echo   Photo Memory failed to start
  echo ========================================
  echo Exit code: %EXIT_CODE%
  echo.
  echo Please read the error message above. If you need help, send the whole window text to the developer.
) else (
  echo ========================================
  echo   Photo Memory start command finished
  echo ========================================
  echo If everything is OK, two new windows should be open:
  echo   Photo Memory Backend :13033
  echo   Photo Memory Frontend :5173
  echo.
  echo Open: http://localhost:5173
)

echo.
pause
exit /b %EXIT_CODE%
