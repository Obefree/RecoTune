@echo off
setlocal EnableExtensions
title RecoTune - Metro (live JS)
set "REPO=C:\Users\lev\Documents\GitHub\RecoTune"
cd /d "%REPO%"
if errorlevel 1 (
  echo [ERROR] Repo not found: %REPO%
  pause
  exit /b 1
)

echo.
echo  === RecoTune Metro (live JS over LAN) ===
echo.
echo  Expo Go SDK 54: should start (expo-av + expo-font ~14.0.12).
echo  Expo Go SDK 55+: in-app screen explains dev build (no blue crash).
echo  Full audio / lock-screen controls: dev build (build-apk.bat -^> app-debug.apk).
echo.
echo  Working dir: %CD%
echo  Git:
git rev-parse --short HEAD 2>nul
if errorlevel 1 echo    (git unavailable^)
git log -1 --oneline 2>nul
echo.

rem Free default Metro port 8081 if stale.
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":8081 "') do taskkill /PID %%a /F >nul 2>&1

set EXPO_NO_TELEMETRY=1

echo  Starting: npx expo start -c   (port 8081, cache cleared)
echo  Tip: VPN/hang at startup - add --offline to the line below (not default).
echo  Scan QR in Expo Go OR open installed dev build on same Wi-Fi.
echo.
call npx expo start -c
echo.
echo  Expo exited. See errors above.
echo.
cmd /k
