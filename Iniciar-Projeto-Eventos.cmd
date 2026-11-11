@echo off
setlocal
cd /d "%~dp0"
title Projeto Eventos - Central de Cotacoes
node -e "if(Number(process.versions.node.split('.')[0])<24)process.exit(1)" >nul 2>&1
if errorlevel 1 (
  echo Para testar o sistema, instale o Node.js 24 ou superior em https://nodejs.org
  pause
  exit /b 1
)
echo Projeto Eventos - Central de Cotacoes
echo O portal sera aberto no navegador. Escolha Consultor demo para testar a central.
echo Mantenha esta janela aberta durante o teste.
node scripts\launch-demo.cjs
set "PROJETO_RESULT=%ERRORLEVEL%"
pause
exit /b %PROJETO_RESULT%
