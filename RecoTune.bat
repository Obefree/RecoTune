@echo off
setlocal EnableExtensions
title RecoTune - Metro (dev build, live JS)
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
echo  HEADS UP (Expo SDK 54): Expo Go can NO LONGER run RecoTune.
echo  Expo dropped expo-av from Expo Go in SDK 54, and RecoTune uses it for
echo  the Tuner/Studio/Media. In Expo Go the app loads the bundle, then crashes
echo  at startup with: "native module 'ExponentAV' doesn't exist" (the blue/red
echo  error after the long load). This is NOT fixable from this .bat.
echo.
echo  USE A DEV BUILD instead (full audio + same one-click live JS):
echo    1) Build once:  build-apk.bat   -^> android\app\build\outputs\apk\debug\app-debug.apk
echo    2) Install app-debug.apk on the phone (USB cable, or copy + open it).
echo    3) Run THIS bat, then open RecoTune on the phone (same Wi-Fi).
echo       The dev build connects to this Metro on port 8081 automatically.
echo.
echo  Working dir: %CD%
echo  Git:
git rev-parse --short HEAD 2>nul
if errorlevel 1 echo    (git unavailable^)
git log -1 --oneline 2>nul
echo.

rem Free the default Metro port (8081) if a stale instance is holding it.
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":8081 "') do taskkill /PID %%a /F >nul 2>&1

set EXPO_NO_TELEMETRY=1

echo  Starting Metro: npx expo start -c   (cache cleared)
echo  Tip: if your network/VPN makes startup hang, add --offline to the line below.
echo.
call npx expo start -c
echo.
echo  Expo exited. See errors above.
echo.
cmd /k
