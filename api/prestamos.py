"""
Préstamos y Visa Cuotas, con sus pagos.
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
from api.modelos import ( PrestamoIn, PagoPrestamoIn, VisacuotaIn, PagoVisacuotaIn,
)

import notion_sync
from api.comun import _borrar

router = APIRouter()


def _prestamo_con_saldo(conn, p):
    saldo = db.saldo_prestamo(conn, p["id"])
    proximo_pago, dias_pago = None, None
    if p["dia_pago"]:
        fecha = notion_sync.proxima_fecha(p["dia_pago"])
        proximo_pago, dias_pago = fecha.isoformat(), (fecha - hoy()).days
    return {
        **dict(p),
        "saldo": saldo,
        "pct_pagado": round((p["saldo_inicial"] - saldo) / p["saldo_inicial"] * 100, 1) if p["saldo_inicial"] else 100.0,
        "proximo_pago": proximo_pago, "dias_pago": dias_pago,
    }


@router.get("/api/prestamos")
def listar_prestamos(incluir_inactivas: bool = False):
    conn = db.get_conn()
    try:
        sql = "SELECT * FROM prestamos" + ("" if incluir_inactivas else " WHERE activo = 1")
        return [_prestamo_con_saldo(conn, p) for p in conn.execute(sql + " ORDER BY nombre").fetchall()]
    finally:
        conn.close()


@router.post("/api/prestamos")
def crear_prestamo(body: PrestamoIn):
    _validar_prestamo_in(body)
    conn = db.get_conn()
    try:
        cur = conn.execute(
            "INSERT INTO prestamos (nombre, institucion, monto_original, saldo_inicial, cuota_mensual, "
            "tasa_interes, dia_pago, fecha_inicio, activo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (body.nombre.strip(), body.institucion.strip(), validar_monto(body.monto_original),
             body.saldo_inicial, validar_monto(body.cuota_mensual), body.tasa_interes,
             body.dia_pago, body.fecha_inicio, int(body.activo)),
        )
        conn.commit()
        return {"id": cur.lastrowid}
    finally:
        conn.close()


@router.put("/api/prestamos/{prestamo_id}")
def editar_prestamo(prestamo_id: int, body: PrestamoIn):
    _validar_prestamo_in(body)
    conn = db.get_conn()
    try:
        validar_prestamo(conn, prestamo_id)
        conn.execute(
            "UPDATE prestamos SET nombre=?, institucion=?, monto_original=?, saldo_inicial=?, "
            "cuota_mensual=?, tasa_interes=?, dia_pago=?, fecha_inicio=?, activo=? WHERE id = ?",
            (body.nombre.strip(), body.institucion.strip(), validar_monto(body.monto_original),
             body.saldo_inicial, validar_monto(body.cuota_mensual), body.tasa_interes,
             body.dia_pago, body.fecha_inicio, int(body.activo), prestamo_id),
        )
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@router.delete("/api/prestamos/{prestamo_id}")
def borrar_prestamo(prestamo_id: int):
    """
    Elimina un préstamo definitivamente. Igual que borrar_tarjeta: si ya
    tiene pagos registrados se bloquea el borrado (prestamo_id es NOT NULL
    en pagos_prestamos, un pago sin préstamo no significa nada) y se pide
    desactivar en su lugar para conservar el historial.
    """
    conn = db.get_conn()
    try:
        validar_prestamo(conn, prestamo_id)
        tiene_pagos = conn.execute(
            "SELECT 1 FROM pagos_prestamos WHERE prestamo_id = ? LIMIT 1", (prestamo_id,)
        ).fetchone()
        if tiene_pagos:
            raise HTTPException(
                400,
                "No podés eliminar un préstamo con pagos ya registrados — "
                "desactivalo en su lugar para conservar ese historial.",
            )
        conn.execute("DELETE FROM prestamos WHERE id = ?", (prestamo_id,))
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


def _validar_prestamo_in(body: PrestamoIn):
    if not body.nombre.strip() or not body.institucion.strip():
        raise HTTPException(400, "Nombre e institución son obligatorios")
    if body.saldo_inicial < 0:
        raise HTTPException(400, "El saldo inicial no puede ser negativo")
    if body.dia_pago is not None and not (1 <= body.dia_pago <= 31):
        raise HTTPException(400, "El día de pago debe estar entre 1 y 31")


@router.post("/api/pagos_prestamos")
def crear_pago_prestamo(body: PagoPrestamoIn):
    conn = db.get_conn()
    try:
        validar_prestamo(conn, body.prestamo_id)
        if body.cuenta_id:
            validar_cuenta(conn, body.cuenta_id)
        cur = conn.execute(
            "INSERT INTO pagos_prestamos (fecha, prestamo_id, cuenta_id, monto) VALUES (?, ?, ?, ?)",
            (validar_fecha(body.fecha), body.prestamo_id, body.cuenta_id, validar_monto(body.monto)),
        )
        conn.commit()
        return {"id": cur.lastrowid}
    finally:
        conn.close()


@router.put("/api/pagos_prestamos/{reg_id}")
def editar_pago_prestamo(reg_id: int, body: PagoPrestamoIn):
    conn = db.get_conn()
    try:
        if not conn.execute("SELECT 1 FROM pagos_prestamos WHERE id = ?", (reg_id,)).fetchone():
            raise HTTPException(404, "Pago no encontrado")
        validar_prestamo(conn, body.prestamo_id)
        if body.cuenta_id:
            validar_cuenta(conn, body.cuenta_id)
        conn.execute(
            "UPDATE pagos_prestamos SET fecha=?, prestamo_id=?, cuenta_id=?, monto=? WHERE id=?",
            (validar_fecha(body.fecha), body.prestamo_id, body.cuenta_id, validar_monto(body.monto), reg_id),
        )
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@router.delete("/api/pagos_prestamos/{reg_id}")
def borrar_pago_prestamo(reg_id: int):
    return _borrar("pagos_prestamos", reg_id)


# ============================================================
# VISA CUOTAS
# ============================================================

def _visacuota_con_saldo(conn, v):
    saldo, cuotas_pagadas = db.saldo_visacuota(conn, v["id"])
    proximo_pago, dias_pago = None, None
    if v["dia_pago"]:
        fecha = notion_sync.proxima_fecha(v["dia_pago"])
        proximo_pago, dias_pago = fecha.isoformat(), (fecha - hoy()).days
    return {
        **dict(v),
        "saldo": saldo,
        "cuotas_pagadas": cuotas_pagadas,
        "cuotas_restantes": max(v["num_cuotas"] - cuotas_pagadas, 0),
        "proximo_pago": proximo_pago, "dias_pago": dias_pago,
    }


@router.get("/api/visacuotas")
def listar_visacuotas(incluir_inactivas: bool = False):
    conn = db.get_conn()
    try:
        sql = "SELECT * FROM visacuotas" + ("" if incluir_inactivas else " WHERE activo = 1")
        return [_visacuota_con_saldo(conn, v) for v in conn.execute(sql + " ORDER BY descripcion").fetchall()]
    finally:
        conn.close()


@router.post("/api/visacuotas")
def crear_visacuota(body: VisacuotaIn):
    _validar_visacuota_in(body)
    conn = db.get_conn()
    try:
        validar_tarjeta(conn, body.tarjeta_id)
        cur = conn.execute(
            "INSERT INTO visacuotas (descripcion, tarjeta_id, monto_total, num_cuotas, cuota_mensual, "
            "fecha_inicio, dia_pago, activo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (body.descripcion.strip(), body.tarjeta_id, validar_monto(body.monto_total), body.num_cuotas,
             validar_monto(body.cuota_mensual), validar_fecha(body.fecha_inicio), body.dia_pago, int(body.activo)),
        )
        conn.commit()
        return {"id": cur.lastrowid}
    finally:
        conn.close()


@router.put("/api/visacuotas/{visacuota_id}")
def editar_visacuota(visacuota_id: int, body: VisacuotaIn):
    _validar_visacuota_in(body)
    conn = db.get_conn()
    try:
        validar_visacuota(conn, visacuota_id)
        validar_tarjeta(conn, body.tarjeta_id)
        conn.execute(
            "UPDATE visacuotas SET descripcion=?, tarjeta_id=?, monto_total=?, num_cuotas=?, cuota_mensual=?, "
            "fecha_inicio=?, dia_pago=?, activo=? WHERE id = ?",
            (body.descripcion.strip(), body.tarjeta_id, validar_monto(body.monto_total), body.num_cuotas,
             validar_monto(body.cuota_mensual), validar_fecha(body.fecha_inicio), body.dia_pago,
             int(body.activo), visacuota_id),
        )
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@router.delete("/api/visacuotas/{visacuota_id}")
def borrar_visacuota(visacuota_id: int):
    """Mismo criterio que borrar_prestamo: bloquear si ya tiene pagos, pedir desactivar."""
    conn = db.get_conn()
    try:
        validar_visacuota(conn, visacuota_id)
        tiene_pagos = conn.execute(
            "SELECT 1 FROM pagos_visacuotas WHERE visacuota_id = ? LIMIT 1", (visacuota_id,)
        ).fetchone()
        if tiene_pagos:
            raise HTTPException(
                400,
                "No podés eliminar una Visa Cuotas con pagos ya registrados — "
                "desactivala en su lugar para conservar ese historial.",
            )
        conn.execute("DELETE FROM visacuotas WHERE id = ?", (visacuota_id,))
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


def _validar_visacuota_in(body: VisacuotaIn):
    if not body.descripcion.strip():
        raise HTTPException(400, "La descripción es obligatoria")
    if body.num_cuotas <= 0:
        raise HTTPException(400, "El número de cuotas debe ser mayor a 0")
    if body.dia_pago is not None and not (1 <= body.dia_pago <= 31):
        raise HTTPException(400, "El día de pago debe estar entre 1 y 31")


@router.post("/api/pagos_visacuotas")
def crear_pago_visacuota(body: PagoVisacuotaIn):
    conn = db.get_conn()
    try:
        validar_visacuota(conn, body.visacuota_id)
        if body.cuenta_id:
            validar_cuenta(conn, body.cuenta_id)
        cur = conn.execute(
            "INSERT INTO pagos_visacuotas (fecha, visacuota_id, cuenta_id, monto) VALUES (?, ?, ?, ?)",
            (validar_fecha(body.fecha), body.visacuota_id, body.cuenta_id, validar_monto(body.monto)),
        )
        conn.commit()
        return {"id": cur.lastrowid}
    finally:
        conn.close()


@router.put("/api/pagos_visacuotas/{reg_id}")
def editar_pago_visacuota(reg_id: int, body: PagoVisacuotaIn):
    conn = db.get_conn()
    try:
        if not conn.execute("SELECT 1 FROM pagos_visacuotas WHERE id = ?", (reg_id,)).fetchone():
            raise HTTPException(404, "Pago no encontrado")
        validar_visacuota(conn, body.visacuota_id)
        if body.cuenta_id:
            validar_cuenta(conn, body.cuenta_id)
        conn.execute(
            "UPDATE pagos_visacuotas SET fecha=?, visacuota_id=?, cuenta_id=?, monto=? WHERE id=?",
            (validar_fecha(body.fecha), body.visacuota_id, body.cuenta_id, validar_monto(body.monto), reg_id),
        )
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@router.delete("/api/pagos_visacuotas/{reg_id}")
def borrar_pago_visacuota(reg_id: int):
    return _borrar("pagos_visacuotas", reg_id)

