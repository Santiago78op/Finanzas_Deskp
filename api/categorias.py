"""
Categorías de ingreso y gasto.
"""

from typing import Optional

from fastapi import APIRouter, HTTPException

import db
from api import comun
from api.comun import (
    MESES_ES, METODOS_VALIDOS, clamp_dia, hoy, marcar_y_sincronizar,
    validar_categoria, validar_cuenta, validar_fecha, validar_monto,
    validar_prestamo, validar_tarjeta, validar_visacuota,
)
from api.modelos import ( CategoriaIn, CategoriaEdit,
)

router = APIRouter()

# Contrato de una categoría (ver tests/test_contrato_api.py).
CAMPOS = "id, nombre, tipo, activa"


@router.get("/api/categorias")
def listar_categorias(tipo: Optional[str] = None, incluir_inactivas: bool = False):
    conn = db.get_conn()
    try:
        # Columnas explícitas y no `SELECT *`: lo que la API promete no puede
        # depender de las columnas que tenga la tabla ese día. Con * , agregar
        # una columna interna la publicaba sola.
        sql, params = f"SELECT {CAMPOS} FROM categorias WHERE 1=1", []
        if tipo:
            sql += " AND tipo = ?"; params.append(tipo)
        if not incluir_inactivas:
            sql += " AND activa = 1"
        sql += " ORDER BY nombre"
        return [dict(f) for f in conn.execute(sql, params).fetchall()]
    finally:
        conn.close()


@router.post("/api/categorias")
def crear_categoria(body: CategoriaIn):
    if body.tipo not in ("ingreso", "gasto"):
        raise HTTPException(400, "El tipo debe ser 'ingreso' o 'gasto'")
    nombre = body.nombre.strip()
    if not nombre:
        raise HTTPException(400, "El nombre no puede estar vacío")
    conn = db.get_conn()
    try:
        existe = conn.execute(
            "SELECT 1 FROM categorias WHERE nombre = ? AND tipo = ?", (nombre, body.tipo)
        ).fetchone()
        if existe:
            raise HTTPException(400, f"Ya existe la categoría '{nombre}' de tipo {body.tipo}")
        cur = conn.execute(
            "INSERT INTO categorias (nombre, tipo) VALUES (?, ?)", (nombre, body.tipo)
        )
        conn.commit()
        return {"id": cur.lastrowid, "nombre": nombre, "tipo": body.tipo, "activa": 1}
    finally:
        conn.close()


@router.put("/api/categorias/{cat_id}")
def editar_categoria(cat_id: int, body: CategoriaEdit):
    conn = db.get_conn()
    try:
        fila = conn.execute("SELECT * FROM categorias WHERE id = ?", (cat_id,)).fetchone()
        if not fila:
            raise HTTPException(404, "Categoría no encontrada")
        nombre = body.nombre.strip() if body.nombre is not None else fila["nombre"]
        activa = int(body.activa) if body.activa is not None else fila["activa"]
        if not nombre:
            raise HTTPException(400, "El nombre no puede estar vacío")
        conn.execute("UPDATE categorias SET nombre = ?, activa = ? WHERE id = ?",
                     (nombre, activa, cat_id))
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()

