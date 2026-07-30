"""
Ingresos, gastos, pagos de tarjeta y la lista combinada con filtros.
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
from api.modelos import ( IngresoIn, GastoIn, PagoIn,
)

import calendar

from api.comun import _borrar

router = APIRouter()


@router.post("/api/ingresos")
def crear_ingreso(body: IngresoIn):
    conn = db.get_conn()
    try:
        validar_categoria(conn, body.categoria_id, "ingreso")
        if body.cuenta_id:
            validar_cuenta(conn, body.cuenta_id)
        cur = conn.execute(
            "INSERT INTO ingresos (fecha, descripcion, categoria_id, monto, cuenta_id) "
            "VALUES (?, ?, ?, ?, ?)",
            (validar_fecha(body.fecha), body.descripcion.strip(),
             body.categoria_id, validar_monto(body.monto), body.cuenta_id),
        )
        conn.commit()
        marcar_y_sincronizar(conn)
        return {"id": cur.lastrowid}
    finally:
        conn.close()


@router.put("/api/ingresos/{reg_id}")
def editar_ingreso(reg_id: int, body: IngresoIn):
    conn = db.get_conn()
    try:
        if not conn.execute("SELECT 1 FROM ingresos WHERE id = ?", (reg_id,)).fetchone():
            raise HTTPException(404, "Ingreso no encontrado")
        validar_categoria(conn, body.categoria_id, "ingreso")
        if body.cuenta_id:
            validar_cuenta(conn, body.cuenta_id)
        conn.execute(
            "UPDATE ingresos SET fecha=?, descripcion=?, categoria_id=?, monto=?, cuenta_id=? "
            "WHERE id=?",
            (validar_fecha(body.fecha), body.descripcion.strip(),
             body.categoria_id, validar_monto(body.monto), body.cuenta_id, reg_id),
        )
        conn.commit()
        marcar_y_sincronizar(conn)
        return {"ok": True}
    finally:
        conn.close()


@router.delete("/api/ingresos/{reg_id}")
def borrar_ingreso(reg_id: int):
    return _borrar("ingresos", reg_id)


@router.post("/api/gastos")
def crear_gasto(body: GastoIn):
    conn = db.get_conn()
    try:
        datos = _validar_gasto(conn, body)
        cur = conn.execute(
            "INSERT INTO gastos (fecha, descripcion, categoria_id, metodo, tarjeta_id, cuenta_id, monto) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)", datos,
        )
        conn.commit()
        marcar_y_sincronizar(conn)
        return {"id": cur.lastrowid}
    finally:
        conn.close()


@router.put("/api/gastos/{reg_id}")
def editar_gasto(reg_id: int, body: GastoIn):
    conn = db.get_conn()
    try:
        if not conn.execute("SELECT 1 FROM gastos WHERE id = ?", (reg_id,)).fetchone():
            raise HTTPException(404, "Gasto no encontrado")
        datos = _validar_gasto(conn, body)
        conn.execute(
            "UPDATE gastos SET fecha=?, descripcion=?, categoria_id=?, metodo=?, tarjeta_id=?, "
            "cuenta_id=?, monto=? WHERE id = ?", datos + (reg_id,),
        )
        conn.commit()
        marcar_y_sincronizar(conn)
        return {"ok": True}
    finally:
        conn.close()


def _validar_gasto(conn, body: GastoIn):
    """Valida un gasto y devuelve la tupla lista para insertar/actualizar."""
    validar_categoria(conn, body.categoria_id, "gasto")
    if body.metodo not in METODOS_VALIDOS:
        raise HTTPException(400, f"Método inválido: {body.metodo}")
    tarjeta_id, cuenta_id = None, None
    if body.metodo == "Tarjeta":
        if not body.tarjeta_id:
            raise HTTPException(400, "Indicá con qué tarjeta fue el gasto")
        validar_tarjeta(conn, body.tarjeta_id)
        tarjeta_id = body.tarjeta_id
    elif body.metodo in ("Débito", "Transferencia") and body.cuenta_id:
        # La cuenta es opcional: si se indica, el gasto descuenta de su saldo
        validar_cuenta(conn, body.cuenta_id)
        cuenta_id = body.cuenta_id
    return (validar_fecha(body.fecha), body.descripcion.strip(), body.categoria_id,
            body.metodo, tarjeta_id, cuenta_id, validar_monto(body.monto))


@router.delete("/api/gastos/{reg_id}")
def borrar_gasto(reg_id: int):
    # Un gasto puede estar referenciado por notion_bandeja_procesados (si vino de
    # la bandeja de Notion). Desvinculamos antes de borrar para no violar la FK; la
    # página queda marcada como procesada y no se reimporta.
    return _borrar("gastos", reg_id, pre_sql=[
        ("UPDATE notion_bandeja_procesados SET gasto_id = NULL WHERE gasto_id = ?", (reg_id,)),
    ])


@router.post("/api/pagos_tarjetas")
def crear_pago(body: PagoIn):
    conn = db.get_conn()
    try:
        validar_tarjeta(conn, body.tarjeta_id)
        if body.cuenta_id:
            validar_cuenta(conn, body.cuenta_id)
        cur = conn.execute(
            "INSERT INTO pagos_tarjetas (fecha, tarjeta_id, cuenta_id, monto) VALUES (?, ?, ?, ?)",
            (validar_fecha(body.fecha), body.tarjeta_id, body.cuenta_id, validar_monto(body.monto)),
        )
        conn.commit()
        marcar_y_sincronizar(conn)
        return {"id": cur.lastrowid}
    finally:
        conn.close()


@router.put("/api/pagos_tarjetas/{reg_id}")
def editar_pago(reg_id: int, body: PagoIn):
    conn = db.get_conn()
    try:
        if not conn.execute("SELECT 1 FROM pagos_tarjetas WHERE id = ?", (reg_id,)).fetchone():
            raise HTTPException(404, "Pago no encontrado")
        validar_tarjeta(conn, body.tarjeta_id)
        if body.cuenta_id:
            validar_cuenta(conn, body.cuenta_id)
        conn.execute(
            "UPDATE pagos_tarjetas SET fecha=?, tarjeta_id=?, cuenta_id=?, monto=? WHERE id=?",
            (validar_fecha(body.fecha), body.tarjeta_id, body.cuenta_id,
             validar_monto(body.monto), reg_id),
        )
        conn.commit()
        marcar_y_sincronizar(conn)
        return {"ok": True}
    finally:
        conn.close()


@router.delete("/api/pagos_tarjetas/{reg_id}")
def borrar_pago(reg_id: int):
    return _borrar("pagos_tarjetas", reg_id)



@router.get("/api/movimientos")
def movimientos(mes: Optional[str] = None, categoria_id: Optional[int] = None,
                metodo: Optional[str] = None, tarjeta_id: Optional[int] = None):
    """
    Lista combinada de ingresos, gastos y pagos de tarjeta.
    mes: 'aaaa-mm'. metodo: Efectivo|Débito|Transferencia|Tarjeta.
    """
    conn = db.get_conn()
    try:
        movs = []

        # Gastos
        sql = """SELECT g.id, g.fecha, g.descripcion, g.monto, g.metodo, g.tarjeta_id,
                        g.cuenta_id, cu.nombre AS cuenta,
                        g.categoria_id, c.nombre AS categoria, t.nombre AS tarjeta
                 FROM gastos g JOIN categorias c ON c.id = g.categoria_id
                 LEFT JOIN tarjetas t ON t.id = g.tarjeta_id
                 LEFT JOIN cuentas cu ON cu.id = g.cuenta_id WHERE 1=1"""
        params = []
        if mes:
            sql += " AND strftime('%Y-%m', g.fecha) = ?"; params.append(mes)
        if categoria_id:
            sql += " AND g.categoria_id = ?"; params.append(categoria_id)
        if metodo:
            sql += " AND g.metodo = ?"; params.append(metodo)
        if tarjeta_id:
            sql += " AND g.tarjeta_id = ?"; params.append(tarjeta_id)
        for f in conn.execute(sql, params):
            d = dict(f)
            d["tipo"] = "gasto"
            d["metodo_etiqueta"] = d["tarjeta"] if d["metodo"] == "Tarjeta" else d["metodo"]
            movs.append(d)

        # Ingresos (solo si el filtro de método/tarjeta no excluye ingresos)
        if not metodo and not tarjeta_id:
            sql = """SELECT i.id, i.fecha, i.descripcion, i.monto, i.categoria_id,
                            i.cuenta_id, cu.nombre AS cuenta, c.nombre AS categoria
                     FROM ingresos i JOIN categorias c ON c.id = i.categoria_id
                     LEFT JOIN cuentas cu ON cu.id = i.cuenta_id WHERE 1=1"""
            params = []
            if mes:
                sql += " AND strftime('%Y-%m', i.fecha) = ?"; params.append(mes)
            if categoria_id:
                sql += " AND i.categoria_id = ?"; params.append(categoria_id)
            for f in conn.execute(sql, params):
                d = dict(f)
                d.update(tipo="ingreso", metodo=None, metodo_etiqueta=d["cuenta"] or "—", tarjeta=None)
                movs.append(d)

        # Pagos de tarjeta (no tienen categoría; se excluyen si se filtra por una)
        if not categoria_id and metodo in (None, "Tarjeta"):
            sql = """SELECT p.id, p.fecha, p.monto, p.tarjeta_id, t.nombre AS tarjeta,
                            p.cuenta_id, cu.nombre AS cuenta
                     FROM pagos_tarjetas p JOIN tarjetas t ON t.id = p.tarjeta_id
                     LEFT JOIN cuentas cu ON cu.id = p.cuenta_id WHERE 1=1"""
            params = []
            if mes:
                sql += " AND strftime('%Y-%m', p.fecha) = ?"; params.append(mes)
            if tarjeta_id:
                sql += " AND p.tarjeta_id = ?"; params.append(tarjeta_id)
            for f in conn.execute(sql, params):
                d = dict(f)
                d.update(tipo="pago", descripcion=f"Pago {d['tarjeta']}", categoria=None,
                         categoria_id=None, metodo=None, metodo_etiqueta=d["tarjeta"])
                movs.append(d)

        # Pagos de préstamo y de Visa Cuotas: no tienen categoría ni método
        # de pago propio, así que solo aplican cuando ninguno de esos
        # filtros (ni el de tarjeta) está activo.
        if not categoria_id and not metodo and not tarjeta_id:
            sql = """SELECT pp.id, pp.fecha, pp.monto, pp.prestamo_id, pr.nombre AS prestamo,
                            pp.cuenta_id, cu.nombre AS cuenta
                     FROM pagos_prestamos pp JOIN prestamos pr ON pr.id = pp.prestamo_id
                     LEFT JOIN cuentas cu ON cu.id = pp.cuenta_id WHERE 1=1"""
            params = []
            if mes:
                sql += " AND strftime('%Y-%m', pp.fecha) = ?"; params.append(mes)
            for f in conn.execute(sql, params):
                d = dict(f)
                d.update(tipo="pago_prestamo", descripcion=f"Pago {d['prestamo']}", categoria=None,
                         categoria_id=None, metodo=None, metodo_etiqueta=d["prestamo"])
                movs.append(d)

            sql = """SELECT pv.id, pv.fecha, pv.monto, pv.visacuota_id, v.descripcion AS visacuota_desc,
                            pv.cuenta_id, cu.nombre AS cuenta
                     FROM pagos_visacuotas pv JOIN visacuotas v ON v.id = pv.visacuota_id
                     LEFT JOIN cuentas cu ON cu.id = pv.cuenta_id WHERE 1=1"""
            params = []
            if mes:
                sql += " AND strftime('%Y-%m', pv.fecha) = ?"; params.append(mes)
            for f in conn.execute(sql, params):
                d = dict(f)
                d.update(tipo="pago_visacuota", descripcion=f"Cuota: {d['visacuota_desc']}", categoria=None,
                         categoria_id=None, metodo=None, metodo_etiqueta=d["visacuota_desc"])
                movs.append(d)

        movs.sort(key=lambda m: (m["fecha"], m["id"]), reverse=True)
        return movs
    finally:
        conn.close()

