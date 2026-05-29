@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem RecoTune - release APK (arm64-only, smaller than debug universal)
title RecoTune Release APK Build

cd /d "%~dp0"
echo.
echo === RecoTune: Android release APK (arm64-v8a) ===
echo Repo: %CD%
echo.

rem --- JAVA_HOME ---
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
if exist "%JAVA_HOME%\bin\java.exe" goto :java_done
set "JAVA_HOME="
if exist "%LOCALAPPDATA%\Programs\Android Studio\jbr\bin\java.exe" set "JAVA_HOME=%LOCALAPPDATA%\Programs\Android Studio\jbr"
if not defined JAVA_HOME for /d %%D in ("C:\Program Files\Android\Android Studio*") do if not defined JAVA_HOME if exist "%%~D\jbr\bin\java.exe" set "JAVA_HOME=%%~D\jbr"
:java_done
if not defined JAVA_HOME (
  echo [ERROR] Could not find Android Studio JBR. Set JAVA_HOME manually.
  pause
  exit /b 1
)
echo [OK] JAVA_HOME=%JAVA_HOME%

rem --- Android SDK ---
set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
set "ANDROID_SDK_ROOT=%ANDROID_HOME%"
if not exist "%ANDROID_HOME%" (
  echo [ERROR] Android SDK not found: %ANDROID_HOME%
  pause
  exit /b 1
)
echo [OK] ANDROID_HOME=%ANDROID_HOME%
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%"
echo.

rem --- npm install ---
echo [Step 1/4] npm install ...
call npm install
if errorlevel 1 (
  echo [ERROR] npm install failed.
  pause
  exit /b 1
)
echo.

rem --- expo prebuild if android\ missing ---
if not exist "android\gradlew.bat" (
  echo [Step 2/4] android\ missing - running: npx expo prebuild --platform android
  call npx expo prebuild --platform android
  if errorlevel 1 (
    echo [ERROR] expo prebuild failed.
    pause
    exit /b 1
  )
) else (
  echo [Step 2/4] android\ present - skipping prebuild.
)
echo.

rem --- Gradle: stop daemon + wipe app\build (Windows mergeReleaseResources locks) ---
echo [Step 2b/4] Prepare Gradle: stop daemon, clear android\app\build ...
if not exist "android\gradlew.bat" (
  echo [ERROR] android\gradlew.bat still missing after prebuild.
  pause
  exit /b 1
)
pushd android
call gradlew.bat --stop >nul 2>&1
timeout /t 3 /nobreak >nul
if exist "app\build" (
  rd /s /q "app\build" 2>nul
  if exist "app\build" (
    echo [ERROR] Could not delete android\app\build. Close Android Studio / emulator and retry.
    popd
    pause
    exit /b 1
  )
  echo [OK] Cleared android\app\build
)
popd
echo.

rem --- Gradle assembleRelease (single ABI, minify via expo-build-properties) ---
echo [Step 3/4] Gradle assembleRelease -PreactNativeArchitectures=arm64-v8a ...
if not exist "android\gradlew.bat" (
  echo [ERROR] android\gradlew.bat still missing.
  pause
  exit /b 1
)
pushd android
call gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a
set "GRADLE_EXIT=!ERRORLEVEL!"
popd
if !GRADLE_EXIT! neq 0 (
  echo [ERROR] Gradle build failed with exit code !GRADLE_EXIT!
  pause
  exit /b !GRADLE_EXIT!
)
echo.

rem --- APK output ---
set "APK_REL=android\app\build\outputs\apk\release\app-release.apk"
set "APK_FULL=%CD%\%APK_REL%"
if not exist "%APK_REL%" (
  echo [ERROR] APK not found: %APK_FULL%
  pause
  exit /b 1
)

echo [Step 4/4] Build succeeded.
echo.
echo APK: %APK_FULL%
for %%A in ("%APK_REL%") do echo Size: %%~zA bytes (~%%~zA / 1048576 MB)
echo.

if not exist "dist" mkdir "dist"
for /f "usebackq delims=" %%T in (`powershell -NoProfile -Command "Get-Date -Format 'yyyy-MM-dd_HHmmss'"`) do set "STAMP=%%T"
set "DIST_COPY=dist\RecoTune-release-arm64_%STAMP%.apk"
copy /Y "%APK_REL%" "%DIST_COPY%" >nul
if exist "%DIST_COPY%" (
  echo Copied to: %CD%\%DIST_COPY%
  for %%B in ("%DIST_COPY%") do echo Copy size: %%~zB bytes
)
echo.
echo Tip: compare with debug universal via build-apk.bat (~160 MB).
echo Done. Press any key to close...
pause
endlocal
exit /b 0
