@echo off
setlocal EnableExtensions
title RecoTune - Metro (Expo Go)
set "REPO=C:\Users\lev\Documents\GitHub\RecoTune"
cd /d "%REPO%"
if errorlevel 1 (
  echo [ERROR] Repo not found: %REPO%
  pause
  exit /b 1
)

echo.
echo  === RecoTune Metro (Expo Go) ===
echo  Does NOT install APK. Phone must open RecoTune in Expo Go (same LAN, port 8088).
echo  Standalone APK from 20-May (RecoTune-release.apk in repo root) is OLD - ignore for JS fixes.
echo.
echo  Offline Metro: skips expo.dev API (fixes "TypeError: fetch failed" on bad network/VPN).
echo  If you need online dependency checks, run: npm run start
echo.
echo  Working dir: %CD%
echo  Repo: %REPO%
echo  Git:
git rev-parse --short HEAD 2>nul
if errorlevel 1 echo    (git unavailable^)
git log -1 --oneline 2>nul
echo.
echo  Source sanity (should change after your edits^):
for /f %%C in ('dir /s /b "%REPO%\src\*.*" 2^>nul ^| find /c /v ""') do echo    src files: %%C
echo.

set "MARK_OK=1"
set "MARK_MSG="

if exist "%REPO%\src\db\songLibrary.ts" (
  set "MARK_SL=OK"
) else (
  set "MARK_SL=MISSING"
  set "MARK_OK=0"
)

if exist "%REPO%\src\metadata\metadataSync.ts" (
  set "MARK_MS=OK"
) else (
  set "MARK_MS=MISSING"
  set "MARK_OK=0"
)

set "MARK_CV3=MISSING"
findstr /c:"chord-v3" "%REPO%\src\screens\ChordsScreen.tsx" >nul 2>&1
if not errorlevel 1 set "MARK_CV3=OK"
findstr /c:"CHORD_LIBRARY_BUILD" "%REPO%\src\db\songLibrary.ts" >nul 2>&1
if not errorlevel 1 (
  findstr /c:"chord-v3" "%REPO%\src\db\songLibrary.ts" >nul 2>&1
  if not errorlevel 1 set "MARK_CV3=OK"
)
if "%MARK_CV3%"=="MISSING" set "MARK_OK=0"

echo  Code markers: songLibrary.ts=%MARK_SL%  metadataSync.ts=%MARK_MS%  chord-v3=%MARK_CV3%
echo.

if "%MARK_OK%"=="1" (
  echo  ========================================
  echo    CHORD LIBRARY BUILD 2026-05-22 (chord-v3)
  echo    In Expo Go - Chords tab MUST show:
  echo      header: build: chord-v3
  echo      Song base subtitle: chord-v3 - seed 2026-05-22
  echo    Search test: beatles, kino, let - NOT empty
  echo    If missing: reload Expo on port 8088 only (not 8081)
  echo  ========================================
  echo.
) else (
  echo  [WARN] New chord library markers missing - you may be on OLD code or wrong folder.
  echo         Expected repo: %REPO%
  echo         Current dir:   %CD%
  echo         Fix: git pull in repo, or copy Desktop RecoTune.bat from repo root.
  echo.
)

netstat -aon 2>nul | findstr ":8081 " >nul
if not errorlevel 1 (
  echo  [WARN] Port 8081 is in use. Expo Go may still point to OLD Metro.
  echo         Close other Metro windows or reload with URL on port 8088.
  echo.
)

for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":8088 "') do taskkill /PID %%a /F >nul 2>&1

set EXPO_OFFLINE=1
set EXPO_NO_TELEMETRY=1

echo  Starting Metro: npx expo start --offline -c --port 8088
echo  QR / URL must use port 8088, not 8081.
echo.
call npx expo start --offline -c --port 8088
echo.
echo  Expo exited. See errors above.
echo.
cmd /k
