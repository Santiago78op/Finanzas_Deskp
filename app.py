"""
app.py — Finanzas personales en quetzales (Q). App local con FastAPI + SQLite.

Para levantarla:  python app.py   →  http://localhost:8000

Este archivo ya no tiene lógica de negocio: arma la aplicación, monta los
routers de api/ y sirve el frontend. Cada recurso vive en su propio módulo
(api/tarjetas.py, api/ahorros.py, ...) y los helpers compartidos en
api/comun.py.

Antes eran 2,516 líneas con los 65 endpoints, los validadores, los modelos y
el import/export de CSV todo junto; encontrar dónde tocar algo implicaba
recorrer el archivo entero, y la lógica de negocio metida en los handlers HTTP
se terminó duplicando más de una vez.
"""

import os

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

import db
from api import (
    ahorros, categorias, cuentas, dashboard, movimientos, notion,
    prestamos, recurrentes, respaldo, tarjetas,
)

app = FastAPI(title="Finanzas Personales")

# Crear la base y precargar categorías al arrancar (idempotente)
db.init_db()

# El orden importa en uno solo: el catch-all del SPA (abajo) tiene que
# registrarse DESPUÉS de todos los /api/*, o se traga las rutas de la API.
for modulo in (categorias, tarjetas, prestamos, cuentas, ahorros,
               movimientos, dashboard, recurrentes, notion, respaldo):
    app.include_router(modulo.router)


# ============================================================
# FRONTEND
# ============================================================

STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/{full_path:path}")
def spa(full_path: str):
    # Fallback de SPA: cualquier ruta que no sea /api/* ni /static/* (esas ya
    # matchearon arriba) devuelve el mismo index.html, para que react-router
    # resuelva el path en el cliente (/dashboard, /registro, etc. — incluso
    # al recargar la página parado en una de esas rutas).
    if full_path.startswith("api/") or full_path.startswith("static/"):
        raise HTTPException(status_code=404)
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))


# ---------- Arranque ----------

if __name__ == "__main__":
    print("Finanzas Personales — http://localhost:8000")
    # SOLO localhost: nadie más en la red (wifi del trabajo, etc.) puede ver tus datos.
    # Para consultar desde el celular se usa la sincronización con Notion.
    #
    # DEDUN_RELOAD=1 (lo pone `start.bat dev` / `./start.sh dev`) reinicia el
    # servidor solo al guardar un .py. Sin esto hay que matar y relanzar a mano
    # cada vez que se toca app.py o db.py. Va por variable de entorno y no por
    # default porque --reload exige pasar la app como string de importación, y
    # eso levanta un proceso supervisor extra que en uso normal no hace falta.
    if os.environ.get("DEDUN_RELOAD") == "1":
        uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
    else:
        uvicorn.run(app, host="127.0.0.1", port=8000)
