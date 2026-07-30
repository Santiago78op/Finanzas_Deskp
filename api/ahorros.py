"""
Ahorros: fondo de emergencia y metas, con capacidad y plan sugerido.
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
from api.modelos import ( AhorroIn, AporteIn,
)

from datetime import date

router = APIRouter()


def _ahorro_con_saldo(conn, fila, promedio=None, hoy_=None):
    """Un sobre con lo que lleva juntado, su objetivo y cuánto le falta por mes."""
    hoy_ = hoy_ or comun.hoy()
    saldo = db.saldo_ahorro(conn, fila["id"])
    objetivo = db.objetivo_ahorro(conn, fila, promedio)
    falta = round(max(0.0, objetivo - saldo), 2) if objetivo else None
    pct = round(min(100.0, saldo / objetivo * 100), 1) if objetivo and objetivo > 0 else None

    # Cuánto habría que apartar por mes para llegar a la fecha objetivo.
    # Sin fecha no hay urgencia que calcular; con fecha vencida, lo que falta
    # se necesita YA (se reporta como el total faltante, no dividido).
    requerido_mensual = None
    if falta and fila["fecha_objetivo"]:
        try:
            objetivo_fecha = date.fromisoformat(fila["fecha_objetivo"])
        except ValueError:
            objetivo_fecha = None
        if objetivo_fecha:
            dias = (objetivo_fecha - hoy_).days
            meses = max(dias / 30.44, 0)
            requerido_mensual = round(falta / meses, 2) if meses >= 1 else falta

    return {
        **dict(fila),
        "saldo": saldo,
        "objetivo_calculado": objetivo,
        "falta": falta,
        "pct": pct,
        "completado": bool(objetivo and saldo >= objetivo),
        "requerido_mensual": requerido_mensual,
    }


def _capacidad_de_ahorro(conn):
    """
    Cuánto podés apartar por mes, con los números reales de la app.

        ingreso recurrente − gasto promedio − cuotas comprometidas

    CUIDADO CON EL DOBLE CONTEO: los gastos hechos con tarjeta YA están en la
    tabla `gastos`, así que el gasto promedio los incluye. Restar además los
    pagos a tarjeta descontaría dos veces la misma compra. Los préstamos y las
    Visa Cuotas sí van aparte: sus pagos no viven en `gastos`.
    """
    ingreso = db.ingreso_mensual_recurrente(conn)
    gasto = db.gasto_mensual_promedio(conn)
    meses_historial = conn.execute(
        """SELECT COUNT(*) AS n FROM (
               SELECT strftime('%Y-%m', fecha) ym FROM gastos
               WHERE strftime('%Y-%m', fecha) < strftime('%Y-%m', 'now')
               GROUP BY ym)"""
    ).fetchone()["n"]

    cuotas = conn.execute(
        "SELECT COALESCE(SUM(cuota_mensual), 0) AS t FROM prestamos WHERE activo = 1"
    ).fetchone()["t"]
    for v in conn.execute("SELECT * FROM visacuotas WHERE activo = 1"):
        _, pagadas = db.saldo_visacuota(conn, v["id"])
        if v["num_cuotas"] - pagadas > 0:  # una cuota ya terminada no compromete nada
            cuotas += v["cuota_mensual"]
    cuotas = round(cuotas, 2)

    mensual = round(ingreso - (gasto or 0) - cuotas, 2)
    return {
        "ingreso_mensual": round(ingreso, 2),
        "gasto_promedio": gasto,
        "cuotas_comprometidas": cuotas,
        "mensual": mensual,
        "quincenal": round(mensual / 2, 2),
        "meses_historial": meses_historial,
    }


def _plan_de_ahorro(ahorros, capacidad_mensual):
    """
    Reparte lo que podés apartar entre el fondo de emergencia y las metas.

    El orden NO es arbitrario y conviene poder defenderlo:

      1. Fondo de emergencia primero. Es la red que evita que un imprevisto
         termine en deuda de tarjeta; comprarse un celular puede esperar, un
         carro descompuesto no.
      2. Metas CON fecha, por su requerido mensual. Ya son un compromiso con
         un plazo: si no reciben lo suyo, la fecha no se cumple.
      3. Metas sin fecha, en partes iguales con lo que sobre. Sin plazo no hay
         criterio para preferir una sobre otra, así que no se inventa uno.

    A nadie se le asigna más de lo que le falta para completarse: el sobrante
    se reporta como `sin_asignar` en vez de inflar una meta ya cumplida.
    """
    if capacidad_mensual <= 0:
        return {"asignaciones": [], "sin_asignar": 0.0, "cubre_metas_con_fecha": None,
                "faltante": 0.0, "capacidad_mensual": capacidad_mensual}

    restante = capacidad_mensual
    asignaciones = []

    def asignar(a, monto, motivo):
        nonlocal restante
        monto = round(min(monto, restante), 2)
        if monto <= 0:
            return
        restante = round(restante - monto, 2)
        asignaciones.append({
            "ahorro_id": a["id"], "nombre": a["nombre"], "tipo": a["tipo"],
            "mensual": monto, "quincenal": round(monto / 2, 2), "motivo": motivo,
        })

    pendientes = [a for a in ahorros if a["activo"] and not a["completado"]]

    for a in pendientes:
        if a["tipo"] == "emergencia" and a["falta"]:
            asignar(a, a["falta"], "Primero la red de seguridad")

    con_fecha = [a for a in pendientes if a["tipo"] == "meta" and a["requerido_mensual"]]
    requerido_con_fecha = round(sum(a["requerido_mensual"] for a in con_fecha), 2)
    for a in con_fecha:
        asignar(a, a["requerido_mensual"], "Para llegar a la fecha")

    sin_fecha = [a for a in pendientes
                 if a["tipo"] == "meta" and not a["requerido_mensual"] and a["falta"]]
    if sin_fecha and restante > 0:
        parte = restante / len(sin_fecha)
        for a in sin_fecha:
            asignar(a, min(parte, a["falta"]), "Reparto del sobrante")

    # ¿Alcanzó para las metas con plazo? Se compara contra lo que realmente
    # recibieron, no contra la capacidad total: el fondo de emergencia cobra antes.
    dado_con_fecha = round(sum(
        x["mensual"] for x in asignaciones
        if any(a["id"] == x["ahorro_id"] for a in con_fecha)), 2)

    return {
        "capacidad_mensual": capacidad_mensual,
        "asignaciones": asignaciones,
        "sin_asignar": round(restante, 2),
        "cubre_metas_con_fecha": (dado_con_fecha >= requerido_con_fecha) if con_fecha else None,
        "faltante": round(max(0.0, requerido_con_fecha - dado_con_fecha), 2),
    }


@router.post("/api/ahorros/aplicar-plan")
def aplicar_plan():
    """
    Aparta de una sola vez lo que el plan sugiere para este mes.

    Genera un aporte por cada sobre con su monto sugerido. No es automático ni
    recurrente: se dispara cuando el usuario lo pide, y se puede deshacer
    borrando los aportes uno por uno.
    """
    conn = db.get_conn()
    try:
        promedio = db.gasto_mensual_promedio(conn)
        ahorros = [_ahorro_con_saldo(conn, f, promedio) for f in
                   conn.execute("SELECT * FROM ahorros WHERE activo = 1")]
        plan = _plan_de_ahorro(ahorros, _capacidad_de_ahorro(conn)["mensual"])
        if not plan["asignaciones"]:
            raise HTTPException(400, "No hay nada que apartar con tu capacidad actual")

        hoy_ = comun.hoy().isoformat()
        for a in plan["asignaciones"]:
            conn.execute(
                "INSERT INTO aportes_ahorro (fecha, ahorro_id, monto, nota) VALUES (?, ?, ?, ?)",
                (hoy_, a["ahorro_id"], a["mensual"], "Plan sugerido"),
            )
        conn.commit()
        return {"aportes": len(plan["asignaciones"]),
                "total": round(sum(a["mensual"] for a in plan["asignaciones"]), 2)}
    finally:
        conn.close()


@router.get("/api/ahorros")
def listar_ahorros(incluir_inactivos: bool = False):
    """
    Sobres + el contexto para decidir cuánto apartar.

    `libre` = dinero en cuentas − apartado. Puede dar NEGATIVO si apartaste más
    de lo que tenés; no se recorta a cero a propósito, porque ese número en
    rojo es justamente el aviso de que las metas no cierran con la realidad.
    """
    conn = db.get_conn()
    try:
        sql = "SELECT * FROM ahorros" + ("" if incluir_inactivos else " WHERE activo = 1")
        filas = conn.execute(sql + " ORDER BY tipo, nombre").fetchall()
        promedio = db.gasto_mensual_promedio(conn)
        ahorros = [_ahorro_con_saldo(conn, f, promedio) for f in filas]

        dinero = round(sum(db.saldo_cuenta(conn, c["id"]) for c in
                           conn.execute("SELECT id FROM cuentas WHERE activa = 1")), 2)
        apartado = db.total_apartado(conn)

        capacidad = _capacidad_de_ahorro(conn)
        return {
            "ahorros": ahorros,
            "dinero_total": dinero,
            "total_apartado": apartado,
            "libre": round(dinero - apartado, 2),
            "capacidad": capacidad,
            "requerido_mensual_total": round(
                sum(a["requerido_mensual"] or 0 for a in ahorros), 2),
            "plan": _plan_de_ahorro(ahorros, capacidad["mensual"]),
        }
    finally:
        conn.close()


def _validar_ahorro_in(body: "AhorroIn"):
    if not body.nombre.strip():
        raise HTTPException(400, "El nombre es obligatorio")
    if body.tipo not in ("emergencia", "meta"):
        raise HTTPException(400, "El tipo debe ser 'emergencia' o 'meta'")
    tiene_monto = body.objetivo is not None
    tiene_meses = body.meses_gastos is not None
    if tiene_monto == tiene_meses:
        raise HTTPException(
            400, "Indicá un objetivo en Q o en meses de gastos, pero no los dos")
    if tiene_monto and body.objetivo <= 0:
        raise HTTPException(400, "El objetivo debe ser mayor a 0")
    if tiene_meses and body.meses_gastos <= 0:
        raise HTTPException(400, "Los meses de gastos deben ser mayores a 0")
    if body.color_idx is not None and not (0 <= body.color_idx <= 5):
        raise HTTPException(400, "color_idx debe estar entre 0 y 5")


@router.post("/api/ahorros")
def crear_ahorro(body: "AhorroIn"):
    _validar_ahorro_in(body)
    conn = db.get_conn()
    try:
        if conn.execute("SELECT 1 FROM ahorros WHERE nombre = ?",
                        (body.nombre.strip(),)).fetchone():
            raise HTTPException(400, f"Ya existe un ahorro llamado '{body.nombre.strip()}'")
        cur = conn.execute(
            "INSERT INTO ahorros (nombre, tipo, objetivo, meses_gastos, fecha_objetivo, "
            "nota, color_idx, activo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (body.nombre.strip(), body.tipo, body.objetivo, body.meses_gastos,
             validar_fecha(body.fecha_objetivo) if body.fecha_objetivo else None,
             (body.nota or "").strip(), body.color_idx, int(body.activo)),
        )
        conn.commit()
        return {"id": cur.lastrowid}
    finally:
        conn.close()


@router.put("/api/ahorros/{ahorro_id}")
def editar_ahorro(ahorro_id: int, body: "AhorroIn"):
    _validar_ahorro_in(body)
    conn = db.get_conn()
    try:
        if not conn.execute("SELECT 1 FROM ahorros WHERE id = ?", (ahorro_id,)).fetchone():
            raise HTTPException(404, "Ahorro no encontrado")
        if conn.execute("SELECT 1 FROM ahorros WHERE nombre = ? AND id != ?",
                        (body.nombre.strip(), ahorro_id)).fetchone():
            raise HTTPException(400, f"Ya existe otro ahorro llamado '{body.nombre.strip()}'")
        conn.execute(
            "UPDATE ahorros SET nombre=?, tipo=?, objetivo=?, meses_gastos=?, "
            "fecha_objetivo=?, nota=?, color_idx=?, activo=? WHERE id = ?",
            (body.nombre.strip(), body.tipo, body.objetivo, body.meses_gastos,
             validar_fecha(body.fecha_objetivo) if body.fecha_objetivo else None,
             (body.nota or "").strip(), body.color_idx, int(body.activo), ahorro_id),
        )
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@router.delete("/api/ahorros/{ahorro_id}")
def borrar_ahorro(ahorro_id: int):
    """Borra el sobre y sus aportes. No toca ninguna cuenta: el dinero nunca
    se movió de lugar, solo dejaba de estar etiquetado."""
    conn = db.get_conn()
    try:
        if not conn.execute("SELECT 1 FROM ahorros WHERE id = ?", (ahorro_id,)).fetchone():
            raise HTTPException(404, "Ahorro no encontrado")
        conn.execute("DELETE FROM aportes_ahorro WHERE ahorro_id = ?", (ahorro_id,))
        conn.execute("DELETE FROM ahorros WHERE id = ?", (ahorro_id,))
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@router.get("/api/ahorros/{ahorro_id}/aportes")
def listar_aportes(ahorro_id: int):
    conn = db.get_conn()
    try:
        return [dict(a) for a in conn.execute(
            "SELECT * FROM aportes_ahorro WHERE ahorro_id = ? ORDER BY fecha DESC, id DESC",
            (ahorro_id,))]
    finally:
        conn.close()


@router.post("/api/ahorros/{ahorro_id}/aportes")
def crear_aporte(ahorro_id: int, body: "AporteIn"):
    """
    Aparta (monto > 0) o saca (monto < 0) plata de un sobre.

    No genera ningún gasto ni ingreso: la plata sigue donde estaba, solo cambia
    de etiqueta. Sacar del sobre tampoco es un gasto — es dejar de tener ese
    dinero comprometido.
    """
    if body.monto == 0:
        raise HTTPException(400, "El monto no puede ser 0")
    conn = db.get_conn()
    try:
        if not conn.execute("SELECT 1 FROM ahorros WHERE id = ?", (ahorro_id,)).fetchone():
            raise HTTPException(404, "Ahorro no encontrado")
        saldo = db.saldo_ahorro(conn, ahorro_id)
        if body.monto < 0 and abs(body.monto) > saldo:
            raise HTTPException(
                400, f"No podés sacar Q{abs(body.monto):,.2f}: el ahorro solo tiene Q{saldo:,.2f}")
        cur = conn.execute(
            "INSERT INTO aportes_ahorro (fecha, ahorro_id, monto, nota) VALUES (?, ?, ?, ?)",
            (validar_fecha(body.fecha), ahorro_id, round(body.monto, 2),
             (body.nota or "").strip()),
        )
        conn.commit()
        return {"id": cur.lastrowid}
    finally:
        conn.close()


@router.delete("/api/ahorros/aportes/{aporte_id}")
def borrar_aporte(aporte_id: int):
    conn = db.get_conn()
    try:
        if not conn.execute("SELECT 1 FROM aportes_ahorro WHERE id = ?", (aporte_id,)).fetchone():
            raise HTTPException(404, "Aporte no encontrado")
        conn.execute("DELETE FROM aportes_ahorro WHERE id = ?", (aporte_id,))
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()

