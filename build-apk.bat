@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem RecoTune - debug APK build (Windows)
title RecoTune APK Build

cd /d "%~dp0"
echo.
echo === RecoTune: Android debug APK build ===
echo Repo: %CD%
echo.

rem --- JAVA_HOME ---
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
if exist "%JAVA_HOME%\bin\java.exe" goto :java_done
echo [WARN] Default JBR not found: %JAVA_HOME%
set "JAVA_HOME="
if exist "%LOCALAPPDATA%\Programs\Android Studio\jbr\bin\java.exe" set "JAVA_HOME=%LOCALAPPDATA%\Programs\Android Studio\jbr"
if not defined JAVA_HOME if exist "C:\Program Files\Android\Android Studio1\jbr\bin\java.exe" set "JAVA_HOME=C:\Program Files\Android\Android Studio1\jbr"
if not defined JAVA_HOME for /d %%D in ("C:\Program Files\Android\Android Studio*") do if not defined JAVA_HOME if exist "%%~D\jbr\bin\java.exe" set "JAVA_HOME=%%~D\jbr"
:java_done
if not defined JAVA_HOME (
  echo [ERROR] Could not find Android Studio JBR. Install Android Studio or set JAVA_HOME.
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

rem --- PATH for this session ---
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%"

where java >nul 2>&1
if errorlevel 1 (
  echo [ERROR] java not on PATH after JAVA_HOME setup.
  pause
  exit /b 1
)
echo [OK] java:
java -version 2>&1
echo.

rem --- npm install (devDeps needed: patch-package) ---
echo [Step 1/4] npm install ...
set "NODE_ENV=development"
call npm install --include=dev
if errorlevel 1 (
  echo [ERROR] npm install failed.
  pause
  exit /b 1
)
echo.

rem --- expo prebuild: SDK 57 regenerates android/ (skip only if already stamped) ---
set "SDK_STAMP=android\.recotune-sdk"
set "BUILT_SDK="
if exist "%SDK_STAMP%" set /p BUILT_SDK=<"%SDK_STAMP%"
if not "%BUILT_SDK%"=="57" (
  echo [Step 2/4] native tree stale/missing - running: npx expo prebuild --platform android --clean
  call npx expo prebuild --platform android --clean
  if errorlevel 1 (
    echo [ERROR] expo prebuild failed.
    pause
    exit /b 1
  )
  echo 57> "%SDK_STAMP%"
) else (
  echo [Step 2/4] android\ already generated for SDK 57.
)
echo.

rem --- Gradle: stop daemon + wipe Windows-locked intermediates ---
echo [Step 2b/4] Prepare Gradle: stop daemon, clear JNI/resource build dirs ...
if not exist "android\gradlew.bat" (
  echo [ERROR] android\gradlew.bat still missing.
  pause
  exit /b 1
)
pushd android
call gradlew.bat --stop >nul 2>&1
timeout /t 3 /nobreak >nul
popd
for %%D in (
  "android\app\build"
  "android\build"
  "node_modules\react-native-music-control\android\build"
  "node_modules\react-native-worklets\android\build"
) do (
  if exist %%D (
    rd /s /q %%D 2>nul
    if exist %%D (
      echo [WARN] Could not fully delete %%D — close Android Studio and retry if Gradle fails on mergeJniLibFolders.
    ) else (
      echo [OK] Cleared %%D
    )
  )
)
echo.

rem --- Gradle assembleDebug ---
echo [Step 3/4] Gradle assembleDebug ...
if not exist "android\gradlew.bat" (
  echo [ERROR] android\gradlew.bat still missing.
  pause
  exit /b 1
)
pushd android
call gradlew.bat assembleDebug
set "GRADLE_EXIT=!ERRORLEVEL!"
popd
if !GRADLE_EXIT! neq 0 (
  echo [ERROR] Gradle build failed with exit code !GRADLE_EXIT!
  pause
  exit /b !GRADLE_EXIT!
)
echo.

rem --- APK output ---
set "APK_REL=android\app\build\outputs\apk\debug\app-debug.apk"
set "APK_FULL=%CD%\%APK_REL%"
if not exist "%APK_REL%" (
  echo [ERROR] APK not found: %APK_FULL%
  pause
  exit /b 1
)

echo [Step 4/4] Build succeeded.
echo.
echo APK: %APK_FULL%
for %%A in ("%APK_REL%") do echo Size: %%~zA bytes
echo.

rem --- Optional copy to dist with timestamp ---
if not exist "dist" mkdir "dist"
for /f "usebackq delims=" %%T in (`powershell -NoProfile -Command "Get-Date -Format 'yyyy-MM-dd_HHmmss'"`) do set "STAMP=%%T"
set "DIST_COPY=dist\RecoTune-debug_%STAMP%.apk"
copy /Y "%APK_REL%" "%DIST_COPY%" >nul
if exist "%DIST_COPY%" (
  echo Copied to: %CD%\%DIST_COPY%
  for %%B in ("%DIST_COPY%") do echo Copy size: %%~zB bytes
) else (
  echo [WARN] Could not copy APK to dist\
)
echo.
echo Done. Press any key to close...
pause
endlocal
exit /b 0
