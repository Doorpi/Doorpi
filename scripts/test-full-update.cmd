@echo off
setlocal

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0test-full-update.ps1" -ForceUpdate

echo.
echo Teste finalizado com codigo %ERRORLEVEL%.
pause
