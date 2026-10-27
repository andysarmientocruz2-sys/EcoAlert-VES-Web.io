@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Necesitas Node.js 22 o superior. Instalalo desde https://nodejs.org
  pause
  exit /b 1
)
if not exist "dist\index.html" (
  echo Preparando EcoAlert por primera vez...
  call npm install --no-audit --no-fund
  if errorlevel 1 goto error
  call npm run build
  if errorlevel 1 goto error
)
node scripts\serve.mjs --open
if errorlevel 1 goto error
exit /b 0
:error
echo No se pudo iniciar EcoAlert. Copia el mensaje de error que aparece arriba.
pause
exit /b 1
