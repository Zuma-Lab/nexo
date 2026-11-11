@echo off
setlocal
cd /d "%~dp0"
title Projeto Eventos - PRD 01
node -e "if(Number(process.versions.node.split('.')[0])<24)process.exit(1)" >nul 2>&1
if errorlevel 1 (
  echo Para testar o sistema, instale o Node.js 24 ou superior em https://nodejs.org
  pause
  exit /b 1
)
echo Projeto Eventos - PRD 01
echo Mantenha esta janela aberta e escolha Sistema integrado no navegador.
node scripts\launch-demo.cjs
set "PROJETO_RESULT=%ERRORLEVEL%"
pause
exit /b %PROJETO_RESULT%
