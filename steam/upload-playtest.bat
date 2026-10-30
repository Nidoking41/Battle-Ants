@echo off
rem Builds the Windows desktop app and uploads it to the Ant Wars Playtest on Steam.
rem Double-click this file. It asks for your Steam login (and Steam Guard code).
cd /d "%~dp0"

echo.
echo === Step 1 of 3: building the game ===
pushd ..
if not exist node_modules call npm install || goto fail
popd
pushd ..\desktop
call npm install || goto fail
call npm run dist || goto fail
popd

echo.
echo === Step 2 of 3: getting SteamCMD (first time only) ===
if not exist steamcmd\steamcmd.exe (
  powershell -NoProfile -Command "Invoke-WebRequest https://steamcdn-a.akamaihd.net/client/installer/steamcmd.zip -OutFile steamcmd.zip; Expand-Archive steamcmd.zip steamcmd -Force; Remove-Item steamcmd.zip" || goto fail
)

echo.
echo === Step 3 of 3: uploading to Steam ===
set /p STEAMUSER=Your Steam login name: 
steamcmd\steamcmd.exe +login %STEAMUSER% +run_app_build "%~dp0app_build_playtest.vdf" +quit || goto fail

echo.
echo Done! Now open Steamworks, Ant Wars Playtest, SteamPipe, Builds, and set the new build live on "default".
pause
exit /b 0

:fail
echo.
echo Something went wrong. Take a screenshot of this window and send it to Claude.
pause
exit /b 1
