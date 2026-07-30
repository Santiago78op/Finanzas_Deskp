"""
Ingresos recurrentes (salario, Bono 14, aguinaldo) y pagos frecuentes.
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
from api.modelos import ( RecurrenteIn, ConfirmarIn, GastoRecurrenteIn,
)

import calendar

router = APIRouter()


@router.get("/api/recurrentes")
def listar_recurrentes():
    conn = db.get_conn()
    try:
        return [dict(f) for f in conn.execute(
            """SELECT r.*, c.nombre AS categoria FROM ingresos_recurrentes r
               JOIN categorias c ON c.id = r.categoria_id ORDER BY r.id"""
        ).fetchall()]
    finally:
        conn.close()


def _validar_recurrente_in(body: RecurrenteIn):
    if not (1 <= body.dia_mes <= 31):
        raise HTTPException(400, "El día del mes debe estar entre 1 y 31")
    if body.frecuencia not in ("Mensual", "Quincenal", "Anual"):
        raise HTTPException(400, "La frecuencia debe ser 'Mensual', 'Quincenal' o 'Anual'")
    if body.frecuencia == "Quincenal":
        if not body.dia_mes_2 or not (1 <= body.dia_mes_2 <= 31):
            raise HTTPException(400, "Para frecuencia quincenal indicá el segundo día (1-31)")
        if body.dia_mes_2 == body.dia_mes:
            raise HTTPException(400, "Los dos días de la quincena deben ser distintos")
    if body.frecuencia == "Anual":
        if not body.mes_1 or not (1 <= body.mes_1 <= 12):
            raise HTTPException(400, "Para frecuencia anual indicá el mes del pago (1-12)")
        if body.mes_2 is not None:
            if not (1 <= body.mes_2 <= 12):
                raise HTTPException(400, "El mes del segundo pago debe estar entre 1 y 12")
            if body.mes_2 == body.mes_1:
                raise HTTPException(400, "Los dos pagos anuales deben caer en meses distintos")


def _campos_anuales(body: RecurrenteIn):
    """
    Normaliza los campos que dependen de la frecuencia, para no repetir la
    misma lógica en el INSERT y en el UPDATE.

    `dia_mes_2` cambia de significado según la frecuencia (segundo día del mes
    en Quincenal, día del segundo pago en Anual), y en Mensual no aplica. Se
    guarda NULL en los campos que no correspondan para que la fila no arrastre
    datos de una frecuencia anterior al editarla.
    """
    if body.frecuencia == "Quincenal":
        return body.dia_mes_2, None, None
    if body.frecuencia == "Anual":
        # Sin día propio para el segundo pago se reutiliza el del primero.
        segundo_dia = body.dia_mes_2 if body.mes_2 else None
        return (segundo_dia or body.dia_mes) if body.mes_2 else None, body.mes_1, body.mes_2
    return None, None, None


@router.post("/api/recurrentes")
def crear_recurrente(body: RecurrenteIn):
    _validar_recurrente_in(body)
    conn = db.get_conn()
    try:
        validar_categoria(conn, body.categoria_id, "ingreso")
        dia_2, mes_1, mes_2 = _campos_anuales(body)
        cur = conn.execute(
            "INSERT INTO ingresos_recurrentes "
            "(descripcion, categoria_id, monto, dia_mes, frecuencia, dia_mes_2, mes_1, mes_2, activo) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (body.descripcion.strip(), body.categoria_id, validar_monto(body.monto),
             body.dia_mes, body.frecuencia, dia_2, mes_1, mes_2, int(body.activo)),
        )
        conn.commit()
        return {"id": cur.lastrowid}
    finally:
        conn.close()


@router.put("/api/recurrentes/{rec_id}")
def editar_recurrente(rec_id: int, body: RecurrenteIn):
    _validar_recurrente_in(body)
    conn = db.get_conn()
    try:
        if not conn.execute("SELECT 1 FROM ingresos_recurrentes WHERE id = ?", (rec_id,)).fetchone():
            raise HTTPException(404, "Ingreso recurrente no encontrado")
        validar_categoria(conn, body.categoria_id, "ingreso")
        dia_2, mes_1, mes_2 = _campos_anuales(body)
        conn.execute(
            "UPDATE ingresos_recurrentes SET descripcion=?, categoria_id=?, monto=?, dia_mes=?, "
            "frecuencia=?, dia_mes_2=?, mes_1=?, mes_2=?, activo=? WHERE id = ?",
            (body.descripcion.strip(), body.categoria_id, validar_monto(body.monto),
             body.dia_mes, body.frecuencia, dia_2, mes_1, mes_2, int(body.activo), rec_id),
        )
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@router.delete("/api/recurrentes/{rec_id}")
def borrar_recurrente(rec_id: int):
    """
    Elimina un ingreso recurrente definitivamente. Los ingresos ya generados
    NO se borran (son historia real); solo se desliga la referencia.
    """
    conn = db.get_conn()
    try:
        if not conn.execute("SELECT 1 FROM ingresos_recurrentes WHERE id = ?", (rec_id,)).fetchone():
            raise HTTPException(404, "Ingreso recurrente no encontrado")
        conn.execute("UPDATE ingresos SET recurrente_id = NULL WHERE recurrente_id = ?", (rec_id,))
        conn.execute("DELETE FROM recurrentes_confirmaciones WHERE recurrente_id = ?", (rec_id,))
        conn.execute("DELETE FROM ingresos_recurrentes WHERE id = ?", (rec_id,))
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


def _pendientes(sql_recurrentes, tabla_confirmaciones):
    """
    Motor único de "pendientes", compartido por ingresos y gastos recurrentes.

    Devuelve las ocurrencias cuyo día ya pasó este mes y que todavía no fueron
    confirmadas ni omitidas. La confirmación se guarda en una tabla aparte de
    ingresos/gastos: borrar el movimiento generado NO vuelve a activar el aviso.

    Antes esto estaba escrito dos veces, con ~40 líneas idénticas cada una. No
    era solo repetición: al agregar la frecuencia Anual hubo que elegir a mano
    cuál de las dos copias editar, y la otra quedó sin soportarla. Con un solo
    motor, la próxima frecuencia que se agregue vale para las dos.

    Lo único que cambia entre los dos casos es el SELECT (los JOIN de cada
    tabla) y en qué tabla viven las confirmaciones — por eso son los dos
    parámetros. El calendario y las etiquetas salen de db.ocurrencias_del_mes y
    db.etiqueta_ocurrencia.

    NOTA: el motor ya soporta 'Anual', pero `gastos_recurrentes` todavía no
    tiene las columnas mes_1/mes_2 ni ese valor en su CHECK, así que en la
    práctica sus filas solo pueden ser Mensual o Quincenal. Habilitarlo es una
    migración más el cambio del formulario.
    """
    hoy_ = comun.hoy()
    ym = hoy_.strftime("%Y-%m")
    conn = db.get_conn()
    try:
        pendientes = []
        for r in conn.execute(sql_recurrentes).fetchall():
            for indice, dia in db.ocurrencias_del_mes(r, hoy_.month):
                fecha_este_mes = clamp_dia(hoy_.year, hoy_.month, dia)
                if fecha_este_mes > hoy_:
                    continue  # todavía no toca este mes
                ya = conn.execute(
                    f"SELECT 1 FROM {tabla_confirmaciones} "
                    "WHERE recurrente_id = ? AND anio_mes = ? AND quincena = ?",
                    (r["id"], ym, indice),
                ).fetchone()
                if not ya:
                    pendientes.append({
                        **dict(r),
                        "quincena": indice,
                        "etiqueta": db.etiqueta_ocurrencia(r, indice),
                        "fecha_sugerida": fecha_este_mes.isoformat(),
                        "mes_nombre": MESES_ES[hoy_.month],
                    })
        return pendientes
    finally:
        conn.close()


@router.get("/api/recurrentes/pendientes")
def recurrentes_pendientes():
    """Ingresos recurrentes (salario, Bono 14, aguinaldo) pendientes de confirmar."""
    return _pendientes(
        """SELECT r.*, c.nombre AS categoria FROM ingresos_recurrentes r
           JOIN categorias c ON c.id = r.categoria_id WHERE r.activo = 1""",
        "recurrentes_confirmaciones",
    )


def _marcar_confirmado(conn, rec_id, ym, quincena):
    """Registra que el recurrente ya fue atendido este mes/quincena (confirmado u omitido)."""
    ya = conn.execute(
        "SELECT 1 FROM recurrentes_confirmaciones "
        "WHERE recurrente_id = ? AND anio_mes = ? AND quincena = ?",
        (rec_id, ym, quincena),
    ).fetchone()
    if ya:
        raise HTTPException(400, "Ese ingreso ya fue confirmado u omitido")
    conn.execute(
        "INSERT INTO recurrentes_confirmaciones (recurrente_id, anio_mes, quincena) "
        "VALUES (?, ?, ?)",
        (rec_id, ym, quincena),
    )


@router.post("/api/recurrentes/{rec_id}/confirmar")
def confirmar_recurrente(rec_id: int, body: ConfirmarIn):
    """Confirma el ingreso recurrente del mes/quincena (con el monto ajustado si varió)."""
    hoy_ = comun.hoy()
    conn = db.get_conn()
    try:
        r = conn.execute("SELECT * FROM ingresos_recurrentes WHERE id = ?", (rec_id,)).fetchone()
        if not r:
            raise HTTPException(404, "Ingreso recurrente no encontrado")
        quincena = 2 if (body.quincena == 2 and r["frecuencia"] == "Quincenal") else 1
        _marcar_confirmado(conn, rec_id, hoy_.strftime("%Y-%m"), quincena)
        dia = r["dia_mes_2"] if quincena == 2 else r["dia_mes"]
        fecha = clamp_dia(hoy_.year, hoy_.month, dia)
        descripcion = r["descripcion"] + (
            f" (quincena {quincena})" if r["frecuencia"] == "Quincenal" else "")
        cur = conn.execute(
            "INSERT INTO ingresos (fecha, descripcion, categoria_id, monto, recurrente_id) "
            "VALUES (?, ?, ?, ?, ?)",
            (fecha.isoformat(), descripcion, r["categoria_id"],
             validar_monto(body.monto), rec_id),
        )
        conn.commit()
        marcar_y_sincronizar(conn)
        return {"id": cur.lastrowid}
    finally:
        conn.close()


@router.post("/api/recurrentes/{rec_id}/omitir")
def omitir_recurrente(rec_id: int, quincena: int = 1):
    """Omite el ingreso recurrente este mes/quincena: no crea ingreso y el aviso desaparece."""
    hoy_ = comun.hoy()
    conn = db.get_conn()
    try:
        r = conn.execute("SELECT * FROM ingresos_recurrentes WHERE id = ?", (rec_id,)).fetchone()
        if not r:
            raise HTTPException(404, "Ingreso recurrente no encontrado")
        q = 2 if (quincena == 2 and r["frecuencia"] == "Quincenal") else 1
        _marcar_confirmado(conn, rec_id, hoy_.strftime("%Y-%m"), q)
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


def _validar_gasto_recurrente_in(conn, body: GastoRecurrenteIn):
    """Valida un pago frecuente y devuelve (tarjeta_id, cuenta_id) ya depurados."""
    validar_categoria(conn, body.categoria_id, "gasto")
    if not (1 <= body.dia_mes <= 31):
        raise HTTPException(400, "El día del mes debe estar entre 1 y 31")
    if body.frecuencia not in ("Mensual", "Quincenal"):
        raise HTTPException(400, "La frecuencia debe ser 'Mensual' o 'Quincenal'")
    if body.frecuencia == "Quincenal":
        if not body.dia_mes_2 or not (1 <= body.dia_mes_2 <= 31):
            raise HTTPException(400, "Para frecuencia quincenal indicá el segundo día (1-31)")
        if body.dia_mes_2 == body.dia_mes:
            raise HTTPException(400, "Los dos días de la quincena deben ser distintos")
    if body.metodo not in METODOS_VALIDOS:
        raise HTTPException(400, f"Método inválido: {body.metodo}")
    tarjeta_id, cuenta_id = None, None
    if body.metodo == "Tarjeta":
        if not body.tarjeta_id:
            raise HTTPException(400, "Indicá con qué tarjeta se paga")
        validar_tarjeta(conn, body.tarjeta_id)
        tarjeta_id = body.tarjeta_id
    elif body.metodo in ("Débito", "Transferencia") and body.cuenta_id:
        validar_cuenta(conn, body.cuenta_id)
        cuenta_id = body.cuenta_id
    return tarjeta_id, cuenta_id


@router.get("/api/gastos_recurrentes")
def listar_gastos_recurrentes():
    conn = db.get_conn()
    try:
        return [dict(f) for f in conn.execute(
            """SELECT g.*, c.nombre AS categoria, t.nombre AS tarjeta, cu.nombre AS cuenta
               FROM gastos_recurrentes g
               JOIN categorias c ON c.id = g.categoria_id
               LEFT JOIN tarjetas t ON t.id = g.tarjeta_id
               LEFT JOIN cuentas cu ON cu.id = g.cuenta_id ORDER BY g.id"""
        ).fetchall()]
    finally:
        conn.close()


@router.post("/api/gastos_recurrentes")
def crear_gasto_recurrente(body: GastoRecurrenteIn):
    conn = db.get_conn()
    try:
        tarjeta_id, cuenta_id = _validar_gasto_recurrente_in(conn, body)
        cur = conn.execute(
            "INSERT INTO gastos_recurrentes "
            "(descripcion, categoria_id, monto, dia_mes, frecuencia, dia_mes_2, "
            " metodo, tarjeta_id, cuenta_id, activo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (body.descripcion.strip(), body.categoria_id, validar_monto(body.monto),
             body.dia_mes, body.frecuencia,
             body.dia_mes_2 if body.frecuencia == "Quincenal" else None,
             body.metodo, tarjeta_id, cuenta_id, int(body.activo)),
        )
        conn.commit()
        return {"id": cur.lastrowid}
    finally:
        conn.close()


@router.put("/api/gastos_recurrentes/{rec_id}")
def editar_gasto_recurrente(rec_id: int, body: GastoRecurrenteIn):
    conn = db.get_conn()
    try:
        if not conn.execute("SELECT 1 FROM gastos_recurrentes WHERE id = ?", (rec_id,)).fetchone():
            raise HTTPException(404, "Pago frecuente no encontrado")
        tarjeta_id, cuenta_id = _validar_gasto_recurrente_in(conn, body)
        conn.execute(
            "UPDATE gastos_recurrentes SET descripcion=?, categoria_id=?, monto=?, dia_mes=?, "
            "frecuencia=?, dia_mes_2=?, metodo=?, tarjeta_id=?, cuenta_id=?, activo=? WHERE id = ?",
            (body.descripcion.strip(), body.categoria_id, validar_monto(body.monto),
             body.dia_mes, body.frecuencia,
             body.dia_mes_2 if body.frecuencia == "Quincenal" else None,
             body.metodo, tarjeta_id, cuenta_id, int(body.activo), rec_id),
        )
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@router.delete("/api/gastos_recurrentes/{rec_id}")
def borrar_gasto_recurrente(rec_id: int):
    """Elimina un pago frecuente definitivamente (los gastos ya generados quedan)."""
    conn = db.get_conn()
    try:
        if not conn.execute("SELECT 1 FROM gastos_recurrentes WHERE id = ?", (rec_id,)).fetchone():
            raise HTTPException(404, "Pago frecuente no encontrado")
        conn.execute("DELETE FROM gastos_rec_confirmaciones WHERE recurrente_id = ?", (rec_id,))
        conn.execute("DELETE FROM gastos_recurrentes WHERE id = ?", (rec_id,))
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@router.get("/api/gastos_recurrentes/pendientes")
def gastos_recurrentes_pendientes():
    """Pagos frecuentes (renta, internet, streaming) pendientes de confirmar."""
    return _pendientes(
        """SELECT g.*, c.nombre AS categoria, t.nombre AS tarjeta, cu.nombre AS cuenta
           FROM gastos_recurrentes g JOIN categorias c ON c.id = g.categoria_id
           LEFT JOIN tarjetas t ON t.id = g.tarjeta_id
           LEFT JOIN cuentas cu ON cu.id = g.cuenta_id WHERE g.activo = 1""",
        "gastos_rec_confirmaciones",
    )


def _marcar_gasto_confirmado(conn, rec_id, ym, quincena):
    ya = conn.execute(
        "SELECT 1 FROM gastos_rec_confirmaciones "
        "WHERE recurrente_id = ? AND anio_mes = ? AND quincena = ?",
        (rec_id, ym, quincena),
    ).fetchone()
    if ya:
        raise HTTPException(400, "Ese pago ya fue confirmado u omitido")
    conn.execute(
        "INSERT INTO gastos_rec_confirmaciones (recurrente_id, anio_mes, quincena) "
        "VALUES (?, ?, ?)",
        (rec_id, ym, quincena),
    )


@router.post("/api/gastos_recurrentes/{rec_id}/confirmar")
def confirmar_gasto_recurrente(rec_id: int, body: ConfirmarIn):
    """Confirma el pago frecuente y crea el gasto con su método preconfigurado."""
    hoy_ = comun.hoy()
    conn = db.get_conn()
    try:
        r = conn.execute("SELECT * FROM gastos_recurrentes WHERE id = ?", (rec_id,)).fetchone()
        if not r:
            raise HTTPException(404, "Pago frecuente no encontrado")
        quincena = 2 if (body.quincena == 2 and r["frecuencia"] == "Quincenal") else 1
        _marcar_gasto_confirmado(conn, rec_id, hoy_.strftime("%Y-%m"), quincena)
        dia = r["dia_mes_2"] if quincena == 2 else r["dia_mes"]
        fecha = clamp_dia(hoy_.year, hoy_.month, dia)
        descripcion = r["descripcion"] + (
            f" (quincena {quincena})" if r["frecuencia"] == "Quincenal" else "")
        cur = conn.execute(
            "INSERT INTO gastos (fecha, descripcion, categoria_id, metodo, tarjeta_id, cuenta_id, monto) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (fecha.isoformat(), descripcion, r["categoria_id"], r["metodo"],
             r["tarjeta_id"], r["cuenta_id"], validar_monto(body.monto)),
        )
        conn.commit()
        marcar_y_sincronizar(conn)
        return {"id": cur.lastrowid}
    finally:
        conn.close()


@router.post("/api/gastos_recurrentes/{rec_id}/omitir")
def omitir_gasto_recurrente(rec_id: int, quincena: int = 1):
    """Omite el pago frecuente este mes/quincena sin crear el gasto."""
    hoy_ = comun.hoy()
    conn = db.get_conn()
    try:
        r = conn.execute("SELECT * FROM gastos_recurrentes WHERE id = ?", (rec_id,)).fetchone()
        if not r:
            raise HTTPException(404, "Pago frecuente no encontrado")
        q = 2 if (quincena == 2 and r["frecuencia"] == "Quincenal") else 1
        _marcar_gasto_confirmado(conn, rec_id, hoy_.strftime("%Y-%m"), q)
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()

