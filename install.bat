@echo off
title UAP AnalyticsBot Installer
echo =====================================================
echo 🚀 Launching UAP AnalyticsBot Automated Setup...
echo =====================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1"
echo.
echo =====================================================
echo Done! Press any key to exit.
echo =====================================================
pause
