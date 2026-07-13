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

echo Finanzas Personales — http://localhost:8000
.venv\Scripts\python app.py
