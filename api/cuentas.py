"""
Cuentas de dinero (Monetaria / Ahorro) y métodos de pago.
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
from api.modelos import ( CuentaIn,
)

router = APIRouter()


@router.get("/api/cuentas")
def listar_cuentas(incluir_inactivas: bool = False):
    conn = db.get_conn()
    try:
        sql = "SELECT * FROM cuentas" + ("" if incluir_inactivas else " WHERE activa = 1")
        return [{**dict(c), "saldo": db.saldo_cuenta(conn, c["id"])}
                for c in conn.execute(sql + " ORDER BY banco, nombre").fetchall()]
    finally:
        conn.close()


@router.post("/api/cuentas")
def crear_cuenta(body: CuentaIn):
    _validar_cuenta_in(body)
    conn = db.get_conn()
    try:
        existe = conn.execute("SELECT 1 FROM cuentas WHERE nombre = ?",
                              (body.nombre.strip(),)).fetchone()
        if existe:
            raise HTTPException(400, f"Ya existe una cuenta llamada '{body.nombre.strip()}'")
        cur = conn.execute(
            "INSERT INTO cuentas (banco, nombre, tipo, saldo_inicial, activa) VALUES (?, ?, ?, ?, ?)",
            (body.banco.strip(), body.nombre.strip(), body.tipo,
             body.saldo_inicial, int(body.activa)),
        )
        conn.commit()
        marcar_y_sincronizar(conn)
        return {"id": cur.lastrowid}
    finally:
        conn.close()


@router.put("/api/cuentas/{cuenta_id}")
def editar_cuenta(cuenta_id: int, body: CuentaIn):
    _validar_cuenta_in(body)
    conn = db.get_conn()
    try:
        validar_cuenta(conn, cuenta_id)
        duplicada = conn.execute("SELECT 1 FROM cuentas WHERE nombre = ? AND id != ?",
                                 (body.nombre.strip(), cuenta_id)).fetchone()
        if duplicada:
            raise HTTPException(400, f"Ya existe otra cuenta llamada '{body.nombre.strip()}'")
        conn.execute(
            "UPDATE cuentas SET banco=?, nombre=?, tipo=?, saldo_inicial=?, activa=? WHERE id = ?",
            (body.banco.strip(), body.nombre.strip(), body.tipo,
             body.saldo_inicial, int(body.activa), cuenta_id),
        )
        conn.commit()
        marcar_y_sincronizar(conn)
        return {"ok": True}
    finally:
        conn.close()


@router.delete("/api/cuentas/{cuenta_id}")
def borrar_cuenta(cuenta_id: int):
    """
    Elimina una cuenta definitivamente. Los movimientos ya registrados con
    esta cuenta NO se borran (son historia real); solo se desliga la
    referencia (quedan como "Sin cuenta"), igual que borrar_recurrente.
    """
    conn = db.get_conn()
    try:
        validar_cuenta(conn, cuenta_id)
        conn.execute("UPDATE gastos SET cuenta_id = NULL WHERE cuenta_id = ?", (cuenta_id,))
        conn.execute("UPDATE ingresos SET cuenta_id = NULL WHERE cuenta_id = ?", (cuenta_id,))
        conn.execute("UPDATE pagos_tarjetas SET cuenta_id = NULL WHERE cuenta_id = ?", (cuenta_id,))
        conn.execute("UPDATE gastos_recurrentes SET cuenta_id = NULL WHERE cuenta_id = ?", (cuenta_id,))
        conn.execute("DELETE FROM cuentas WHERE id = ?", (cuenta_id,))
        conn.commit()
        marcar_y_sincronizar(conn)
        return {"ok": True}
    finally:
        conn.close()


def _validar_cuenta_in(body: CuentaIn):
    if not body.nombre.strip() or not body.banco.strip():
        raise HTTPException(400, "Banco y nombre son obligatorios")
    if body.tipo not in ("Monetaria", "Ahorro"):
        raise HTTPException(400, "El tipo debe ser 'Monetaria' o 'Ahorro'")


@router.get("/api/metodos_pago")
def metodos_pago():
    """Métodos fijos + tarjetas activas, para armar los botones del formulario."""
    conn = db.get_conn()
    try:
        metodos = [{"metodo": m, "tarjeta_id": None, "etiqueta": m} for m in db.METODOS_FIJOS]
        for t in conn.execute("SELECT id, nombre FROM tarjetas WHERE activa = 1 ORDER BY nombre"):
            metodos.append({"metodo": "Tarjeta", "tarjeta_id": t["id"], "etiqueta": t["nombre"]})
        return metodos
    finally:
        conn.close()

