@echo off
rem start.bat - Arranque en Windows con doble clic o desde la terminal.
rem
rem   start.bat            arranca la app en http://localhost:8000
rem   start.bat dev        igual, pero recarga sola al guardar un .py
rem   start.bat test       corre la suite de pruebas y sale
rem   start.bat --no-build arranca sin recompilar el frontend (mas rapido)
rem
rem CAMBIO IMPORTANTE respecto a la version anterior: el frontend se recompila
rem SIEMPRE. Antes solo se construia si static\index.html no existia, asi que
rem tocabas frontend\src, arrancabas, y seguias viendo el build viejo sin
rem ningun aviso. El build tarda menos de un segundo. Para saltarlo: --no-build.
setlocal
cd /d "%~dp0"

set "MODO=%~1"
if "%MODO%"=="" set "MODO=run"
set "PY=.venv\Scripts\python.exe"
set "PIP=.venv\Scripts\pip.exe"

rem ---------- Prerequisitos ----------
rem Se avisa ACA y con nombre y apellido. Antes, si faltaba node, el script
rem moria a mitad del npm install con un error que no decia que instalar.
where python >nul 2>&1
if errorlevel 1 (
    echo.
    echo [X] Falta Python. Instalalo desde https://python.org y volve a correr esto.
    goto :fin
)

set "NECESITA_NODE=1"
if "%MODO%"=="test" set "NECESITA_NODE=0"
if "%MODO%"=="--no-build" set "NECESITA_NODE=0"
if "%NECESITA_NODE%"=="1" (
    where npm >nul 2>&1
    if errorlevel 1 (
        echo.
        echo [X] Falta Node.js ^(npm^). Instalalo desde https://nodejs.org
        echo     Hace falta para compilar el frontend.
        goto :fin
    )
)

rem ---------- Entorno virtual ----------
if not exist ".venv" (
    echo.
    echo ^> Creando entorno virtual ^(.venv^)...
    python -m venv .venv
    if errorlevel 1 goto :error_venv
    "%PY%" -m pip install --upgrade pip
)

rem Se reinstalan las dependencias si requirements.txt cambio desde la ultima
rem vez (el sello guarda una copia). Antes, agregar una dependencia al archivo
rem no hacia nada: el script solo instalaba al crear el .venv desde cero.
set "SELLO=.venv\.requirements-instalado"
set "REINSTALAR=0"
if not exist "%SELLO%" (
    set "REINSTALAR=1"
) else (
    fc /b requirements.txt "%SELLO%" >nul 2>&1 || set "REINSTALAR=1"
)
if "%REINSTALAR%"=="1" (
    echo.
    echo ^> Instalando dependencias de Python...
    "%PIP%" install -r requirements.txt
    if errorlevel 1 goto :error_pip
    copy /y requirements.txt "%SELLO%" >nul
)

rem ---------- Pruebas ----------
if "%MODO%"=="test" (
    "%PY%" -c "import pytest" >nul 2>&1
    if errorlevel 1 (
        echo.
        echo ^> Instalando dependencias de prueba...
        "%PIP%" install -r requirements-dev.txt
        if errorlevel 1 goto :error_pip
    )
    echo.
    echo ^> Corriendo la suite...
    "%PY%" -m pytest
    goto :fin
)

rem ---------- Frontend ----------
if not "%MODO%"=="--no-build" (
    if not exist "frontend\node_modules" (
        echo.
        echo ^> Instalando paquetes de npm ^(solo la primera vez^)...
        pushd frontend && call npm install & popd
    )
    echo.
    echo ^> Compilando el frontend ^(frontend\ -^> static\^)...
    pushd frontend && call npm run build & popd
)
if not exist "static\index.html" (
    echo.
    echo [X] No hay build del frontend en static\. Corre start.bat sin --no-build.
    goto :fin
)

rem ---------- Arranque ----------
if "%MODO%"=="dev" (
    echo.
    echo ^> Modo desarrollo: el servidor se reinicia solo al guardar un .py
    set "DEDUN_RELOAD=1"
)
echo.
echo Finanzas Personales - http://localhost:8000
"%PY%" app.py
goto :fin

:error_venv
echo.
echo [X] No se pudo crear el entorno virtual.
goto :fin

:error_pip
echo.
echo [X] No se pudieron instalar las dependencias.
echo     Si estas detras de un proxy corporativo y ves un error 407, proba:
echo         set NO_PROXY=*
echo         %PIP% install -r requirements.txt
goto :fin

:fin
endlocal
