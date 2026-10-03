@echo off
title UAP Government Packs Synchronizer
echo =====================================================
echo  UAP Government Release Packs Synchronizer & Monitor
echo =====================================================
echo Checking for downloaded content and new drops...
echo.

node scripts\sync-government-packs.js %*

echo.
pause
