#!/bin/bash
# start.sh — Arranque en macOS / Linux.
#
#   ./start.sh            arranca la app en http://localhost:8000
#   ./start.sh dev        igual, pero recarga sola al guardar un .py
#   ./start.sh test       corre la suite de pruebas y sale
#   ./start.sh --no-build arranca sin recompilar el frontend (más rápido)
#
# CAMBIO IMPORTANTE respecto a la versión anterior: el frontend se recompila
# SIEMPRE. Antes solo se construía si static/index.html no existía, así que
# tocabas frontend/src, arrancabas, y seguías viendo el build viejo sin ningún
# aviso. El build tarda menos de un segundo; no vale la pena el ahorro a
# cambio de esa confusión. Si de verdad lo querés saltar, está --no-build.
set -euo pipefail
cd "$(dirname "$0")"

MODO="${1:-run}"

# Un venv guarda los ejecutables en bin/ (macOS, Linux) o en Scripts/ (los que
# crea Python en Windows). Este script es para macOS/Linux, pero también se
# corre desde Git Bash en Windows sobre un .venv hecho por start.bat — y ahí
# .venv/bin no existe. Se resuelve el layout en vez de asumirlo.
if [ -x ".venv/Scripts/python.exe" ]; then
    PY=".venv/Scripts/python.exe"
    PIP=".venv/Scripts/pip.exe"
else
    PY=".venv/bin/python"
    PIP=".venv/bin/pip"
fi

muere() { printf '\n[X] %s\n' "$1" >&2; exit 1; }
paso()  { printf '\n> %s\n' "$1"; }

# ---------- Prerequisitos ----------
# Se avisa ACÁ y con nombre y apellido. Antes, si faltaba node, el script
# moría a mitad del npm install con un error que no decía qué instalar.
command -v python3 >/dev/null 2>&1 || muere "Falta python3. Instalalo desde https://python.org y volvé a correr esto."

NECESITA_NODE=1
[ "$MODO" = "test" ] && NECESITA_NODE=0
[ "$MODO" = "--no-build" ] && NECESITA_NODE=0
if [ "$NECESITA_NODE" = "1" ] && ! command -v npm >/dev/null 2>&1; then
    muere "Falta Node.js (npm). Instalalo desde https://nodejs.org — hace falta para compilar el frontend."
fi

# ---------- Entorno virtual ----------
if [ ! -d ".venv" ]; then
    paso "Creando entorno virtual (.venv)..."
    python3 -m venv .venv
    "$PIP" install --upgrade pip
fi

# Se reinstalan las dependencias si requirements.txt cambió desde la última
# vez (el sello guarda una copia). Antes, agregar una dependencia al archivo
# no hacía nada: el script solo instalaba al crear el .venv desde cero.
SELLO=".venv/.requirements-instalado"
if [ ! -f "$SELLO" ] || ! cmp -s requirements.txt "$SELLO"; then
    paso "Instalando dependencias de Python..."
    "$PIP" install -r requirements.txt || muere \
"No se pudieron instalar las dependencias.
   Si estás detrás de un proxy corporativo y ves un error 407, probá:
       NO_PROXY='*' $PIP install -r requirements.txt"
    cp requirements.txt "$SELLO"
fi

# ---------- Pruebas ----------
if [ "$MODO" = "test" ]; then
    if ! "$PY" -c "import pytest" >/dev/null 2>&1; then
        paso "Instalando dependencias de prueba..."
        "$PIP" install -r requirements-dev.txt
    fi
    paso "Corriendo la suite..."
    exec "$PY" -m pytest
fi

# ---------- Frontend ----------
if [ "$MODO" != "--no-build" ]; then
    [ -d "frontend/node_modules" ] || (paso "Instalando paquetes de npm (solo la primera vez)..."; cd frontend && npm install)
    paso "Compilando el frontend (frontend/ -> static/)..."
    (cd frontend && npm run build)
fi
[ -f "static/index.html" ] || muere "No hay build del frontend en static/. Corré ./start.sh sin --no-build."

# ---------- Arranque ----------
if [ "$MODO" = "dev" ]; then
    paso "Modo desarrollo: el servidor se reinicia solo al guardar un .py"
    export DEDUN_RELOAD=1
fi
echo
echo "Finanzas Personales — http://localhost:8000"
exec "$PY" app.py
