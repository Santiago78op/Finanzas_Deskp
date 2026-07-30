"""
Tarjetas de crédito: saldo, límite y valores del resumen del banco.
"""

from typing import Optional

from fastapi import APIRouter, HTTPException

import db
from api import comun
from api.comun import (
    MESES_ES, METODOS_VALIDOS, clamp_dia, marcar_y_sincronizar,
    validar_categoria, validar_cuenta, validar_fecha, validar_monto,
    validar_prestamo, validar_tarjeta, validar_visacuota,
)
from api.modelos import ( TarjetaIn,
)

import notion_sync

router = APIRouter()


def _resumen_vencido(t):
    """True si los valores del resumen quedaron viejos: se cargaron antes del
    último corte que ya pasó (o sea, cerró un resumen nuevo desde entonces)."""
    tiene_valores = any(t[k] is not None for k in ("saldo_dia", "saldo_corte", "pago_contado"))
    if not tiene_valores or not t["resumen_actualizado"]:
        return False
    ultimo_corte = notion_sync.ultima_fecha(t["dia_corte"]).isoformat()
    return t["resumen_actualizado"] < ultimo_corte


def _tarjeta_con_saldo(conn, t):
    """Arma el dict de una tarjeta con saldo, disponible, % de uso y días a corte/pago."""
    saldo = db.saldo_tarjeta(conn, t["id"])
    hoy_ = comun.hoy()
    # saldo_dia / saldo_corte / pago_contado son valores del resumen cargados a
    # mano: llegan tal cual desde dict(t) (pueden ser None si no se completaron).
    return {
        **dict(t),
        "saldo": saldo,
        "resumen_vencido": _resumen_vencido(t),
        "disponible": round(t["limite"] - saldo, 2),
        "pct_uso": round(saldo / t["limite"] * 100, 1) if t["limite"] else 0,
        "proximo_corte": notion_sync.proxima_fecha(t["dia_corte"]).isoformat(),
        "proximo_pago": notion_sync.proxima_fecha(t["dia_pago"]).isoformat(),
        "dias_corte": (notion_sync.proxima_fecha(t["dia_corte"]) - hoy_).days,
        "dias_pago": (notion_sync.proxima_fecha(t["dia_pago"]) - hoy_).days,
    }


@router.get("/api/tarjetas")
def listar_tarjetas(incluir_inactivas: bool = False):
    conn = db.get_conn()
    try:
        sql = "SELECT * FROM tarjetas" + ("" if incluir_inactivas else " WHERE activa = 1")
        return [_tarjeta_con_saldo(conn, t)
                for t in conn.execute(sql + " ORDER BY nombre").fetchall()]
    finally:
        conn.close()


def _fecha_resumen(body, previo=None):
    """Fecha (ISO) para resumen_actualizado: hoy_ cuando se cargan o cambian los
    valores del resumen; None si no hay ninguno; se conserva la previa si los
    valores no cambiaron (así no se 'refresca' al editar otra cosa)."""
    nuevos = (body.saldo_dia, body.saldo_corte, body.pago_contado)
    if all(v is None for v in nuevos):
        return None
    if previo is None or nuevos != (previo["saldo_dia"], previo["saldo_corte"], previo["pago_contado"]):
        return comun.hoy().isoformat()
    return previo["resumen_actualizado"]


@router.post("/api/tarjetas")
def crear_tarjeta(body: TarjetaIn):
    _validar_tarjeta_in(body)
    conn = db.get_conn()
    try:
        existe = conn.execute("SELECT 1 FROM tarjetas WHERE nombre = ?",
                              (body.nombre.strip(),)).fetchone()
        if existe:
            raise HTTPException(400, f"Ya existe una tarjeta llamada '{body.nombre.strip()}'")
        cur = conn.execute(
            "INSERT INTO tarjetas (banco, nombre, limite, dia_corte, dia_pago, saldo_inicial, "
            "activa, color_idx, marca, saldo_dia, saldo_corte, pago_contado, resumen_actualizado) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (body.banco.strip(), body.nombre.strip(), validar_monto(body.limite),
             body.dia_corte, body.dia_pago, body.saldo_inicial, int(body.activa), body.color_idx,
             body.marca, body.saldo_dia, body.saldo_corte, body.pago_contado, _fecha_resumen(body)),
        )
        conn.commit()
        marcar_y_sincronizar(conn)
        return {"id": cur.lastrowid}
    finally:
        conn.close()


@router.put("/api/tarjetas/{tarjeta_id}")
def editar_tarjeta(tarjeta_id: int, body: TarjetaIn):
    _validar_tarjeta_in(body)
    conn = db.get_conn()
    try:
        validar_tarjeta(conn, tarjeta_id)
        duplicada = conn.execute("SELECT 1 FROM tarjetas WHERE nombre = ? AND id != ?",
                                 (body.nombre.strip(), tarjeta_id)).fetchone()
        if duplicada:
            raise HTTPException(400, f"Ya existe otra tarjeta llamada '{body.nombre.strip()}'")
        previo = conn.execute(
            "SELECT saldo_dia, saldo_corte, pago_contado, resumen_actualizado "
            "FROM tarjetas WHERE id = ?", (tarjeta_id,)).fetchone()
        conn.execute(
            "UPDATE tarjetas SET banco=?, nombre=?, limite=?, dia_corte=?, dia_pago=?, "
            "saldo_inicial=?, activa=?, color_idx=?, marca=?, saldo_dia=?, saldo_corte=?, "
            "pago_contado=?, resumen_actualizado=? WHERE id = ?",
            (body.banco.strip(), body.nombre.strip(), validar_monto(body.limite),
             body.dia_corte, body.dia_pago, body.saldo_inicial, int(body.activa),
             body.color_idx, body.marca, body.saldo_dia, body.saldo_corte, body.pago_contado,
             _fecha_resumen(body, previo), tarjeta_id),
        )
        conn.commit()
        marcar_y_sincronizar(conn)
        return {"ok": True}
    finally:
        conn.close()


@router.delete("/api/tarjetas/{tarjeta_id}")
def borrar_tarjeta(tarjeta_id: int):
    """
    Elimina una tarjeta definitivamente. Los gastos ya registrados con esta
    tarjeta NO se borran (son historia real); solo se desliga la referencia,
    igual que borrar_cuenta/borrar_recurrente. Los pagos a tarjeta SÍ
    requieren tarjeta_id (no puede ser NULL en el esquema — un pago sin
    tarjeta no significa nada), así que si hay pagos registrados se bloquea
    el borrado y se pide desactivar en su lugar.
    """
    conn = db.get_conn()
    try:
        validar_tarjeta(conn, tarjeta_id)
        tiene_pagos = conn.execute(
            "SELECT 1 FROM pagos_tarjetas WHERE tarjeta_id = ? LIMIT 1", (tarjeta_id,)
        ).fetchone()
        if tiene_pagos:
            raise HTTPException(
                400,
                "No podés eliminar una tarjeta con pagos ya registrados — "
                "desactivala en su lugar para conservar ese historial.",
            )
        conn.execute("UPDATE gastos SET tarjeta_id = NULL WHERE tarjeta_id = ?", (tarjeta_id,))
        conn.execute("UPDATE gastos_recurrentes SET tarjeta_id = NULL WHERE tarjeta_id = ?", (tarjeta_id,))
        conn.execute("DELETE FROM tarjetas WHERE id = ?", (tarjeta_id,))
        conn.commit()
        marcar_y_sincronizar(conn)
        return {"ok": True}
    finally:
        conn.close()


def _validar_tarjeta_in(body: TarjetaIn):
    if not body.nombre.strip() or not body.banco.strip():
        raise HTTPException(400, "Banco y nombre son obligatorios")
    if body.color_idx is not None and not (0 <= body.color_idx <= 5):
        raise HTTPException(400, "color_idx debe estar entre 0 y 5")
    if body.marca is not None and body.marca not in ("Visa", "Mastercard"):
        raise HTTPException(400, "marca debe ser 'Visa' o 'Mastercard'")
    if not (1 <= body.dia_corte <= 31) or not (1 <= body.dia_pago <= 31):
        raise HTTPException(400, "Los días de corte y pago deben estar entre 1 y 31")
    if body.saldo_inicial < 0:
        raise HTTPException(400, "El saldo inicial no puede ser negativo")

