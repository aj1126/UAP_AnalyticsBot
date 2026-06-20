@echo off
title UAP AnalyticsBot Runner
echo =====================================================
echo 🚀 Running UAP AnalyticsBot...
echo =====================================================
if "%~1"=="" (
    echo [INFO] Tip: You can drag and drop a folder directly onto this script to analyze it.
    echo.
    set /p "target_folder=Please paste the path of the folder you want to analyze: "
) else (
    set "target_folder=%~1"
)

:: Remove surrounding quotes if they exist
set "target_folder=%target_folder:"=%"

if not exist "%target_folder%" (
    echo.
    echo [ERROR] The specified folder does not exist: "%target_folder%"
    echo.
    pause
    exit /b 1
)

echo Analyzing: "%target_folder%"
echo.
npm start -- "%target_folder%"
echo.
echo =====================================================
echo Execution complete.
echo =====================================================
pause
