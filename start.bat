@echo off
rem start.bat — Arranque en Windows con doble clic o "start.bat" en la terminal.
rem La primera vez crea un entorno virtual e instala las dependencias.
cd /d "%~dp0"

if not exist ".venv" (
    echo Creando entorno virtual ^(.venv^)...
    python -m venv .venv
    .venv\Scripts\python -m pip install --upgrade pip
    .venv\Scripts\python -m pip install -r requirements.txt
)

rem Compilar el frontend (React/Vite) si todavia no existe el build en static/
rem (clone nuevo, o primera vez tras la migracion). Para reconstruirlo a mano
rem despues de tocar frontend\src: cd frontend && npm run build
if not exist "static\index.html" (
    echo Compilando el frontend...
    cd frontend
    call npm install
    call npm run build
    cd ..
)

echo Finanzas Personales — http://localhost:8000
.venv\Scripts\python app.py
