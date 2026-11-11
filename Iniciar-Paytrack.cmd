@echo off
setlocal
cd /d "%~dp0"
call Iniciar-Projeto-Eventos.cmd
exit /b %ERRORLEVEL%
