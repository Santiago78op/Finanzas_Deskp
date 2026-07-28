#!/bin/bash
# start.sh — Arranque en macOS / Linux con un solo comando.
# La primera vez crea un entorno virtual e instala las dependencias.
set -e
cd "$(dirname "$0")"

# Crear el entorno virtual si no existe
if [ ! -d ".venv" ]; then
    echo "Creando entorno virtual (.venv)..."
    python3 -m venv .venv
    ./.venv/bin/pip install --upgrade pip
    ./.venv/bin/pip install -r requirements.txt
fi

# Compilar el frontend (React/Vite) si todavía no existe el build en static/
# (clone nuevo, o primera vez tras la migración). Para reconstruirlo a mano
# después de tocar frontend/src: cd frontend && npm run build
if [ ! -f "static/index.html" ]; then
    echo "Compilando el frontend (frontend/ -> static/)..."
    (cd frontend && npm install && npm run build)
fi

echo "Finanzas Personales — http://localhost:8000"
./.venv/bin/python app.py
