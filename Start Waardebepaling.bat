@echo off
title Waardebepaling OEV
echo.
echo  ============================================
echo   Waardebepaling OEV - Parttracker BV
echo  ============================================
echo.
echo  App wordt gestart, even geduld...
echo  (Dit venster mag je minimaliseren)
echo.

:: Check if node_modules exists, if not run npm install first
if not exist "node_modules\" (
    echo  Eerste keer opstarten - benodigde bestanden worden geinstalleerd...
    echo  Dit duurt eenmalig een paar minuten.
    echo.
    npm install
    echo.
)

:: Check if .next build exists, if not build first
if not exist ".next\" (
    echo  App wordt voor het eerst gebouwd...
    echo  Dit duurt eenmalig een paar minuten.
    echo.
    npm run build
    echo.
)

:: Start the app
echo  App gestart! Openen in browser...
echo.
start "" "http://localhost:3000"
npm start

pause
