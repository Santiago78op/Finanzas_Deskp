"""
Exportar e importar la base como CSV.
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

import csv
import io
import zipfile
from datetime import datetime
from fastapi import File, UploadFile
from fastapi.responses import StreamingResponse

router = APIRouter()


def _query_export(conn, tabla):
    """Filas de exportación por tabla, con nombres legibles en vez de IDs."""
    consultas = {
        "categorias": ("nombre,tipo,activa",
                       "SELECT nombre, tipo, activa FROM categorias ORDER BY tipo, nombre"),
        "tarjetas": ("banco,nombre,limite,dia_corte,dia_pago,saldo_inicial,activa,marca,saldo_dia,saldo_corte,pago_contado,resumen_actualizado",
                     "SELECT banco, nombre, limite, dia_corte, dia_pago, saldo_inicial, activa, "
                     "marca, saldo_dia, saldo_corte, pago_contado, resumen_actualizado FROM tarjetas"),
        "cuentas": ("banco,nombre,tipo,saldo_inicial,activa",
                    "SELECT banco, nombre, tipo, saldo_inicial, activa FROM cuentas"),
        "ingresos": ("fecha,descripcion,categoria,monto,cuenta",
                     """SELECT i.fecha, i.descripcion, c.nombre, i.monto, cu.nombre
                        FROM ingresos i JOIN categorias c ON c.id = i.categoria_id
                        LEFT JOIN cuentas cu ON cu.id = i.cuenta_id ORDER BY i.fecha"""),
        "gastos": ("fecha,descripcion,categoria,metodo,monto,cuenta",
                   """SELECT g.fecha, g.descripcion, c.nombre,
                             CASE WHEN g.metodo = 'Tarjeta' THEN t.nombre ELSE g.metodo END,
                             g.monto, cu.nombre
                      FROM gastos g JOIN categorias c ON c.id = g.categoria_id
                      LEFT JOIN tarjetas t ON t.id = g.tarjeta_id
                      LEFT JOIN cuentas cu ON cu.id = g.cuenta_id ORDER BY g.fecha"""),
        "pagos_tarjetas": ("fecha,tarjeta,monto,cuenta",
                           """SELECT p.fecha, t.nombre, p.monto, cu.nombre FROM pagos_tarjetas p
                              JOIN tarjetas t ON t.id = p.tarjeta_id
                              LEFT JOIN cuentas cu ON cu.id = p.cuenta_id ORDER BY p.fecha"""),
        "ingresos_recurrentes": ("descripcion,categoria,monto,dia_mes,frecuencia,dia_mes_2,mes_1,mes_2,activo",
                                 """SELECT r.descripcion, c.nombre, r.monto, r.dia_mes,
                                           r.frecuencia, r.dia_mes_2, r.mes_1, r.mes_2, r.activo
                                    FROM ingresos_recurrentes r
                                    JOIN categorias c ON c.id = r.categoria_id"""),
        "gastos_recurrentes": ("descripcion,categoria,monto,dia_mes,frecuencia,dia_mes_2,mes_1,mes_2,metodo,cuenta,activo",
                               """SELECT g.descripcion, c.nombre, g.monto, g.dia_mes,
                                         g.frecuencia, g.dia_mes_2, g.mes_1, g.mes_2,
                                         CASE WHEN g.metodo = 'Tarjeta' THEN t.nombre ELSE g.metodo END,
                                         cu.nombre, g.activo
                                  FROM gastos_recurrentes g
                                  JOIN categorias c ON c.id = g.categoria_id
                                  LEFT JOIN tarjetas t ON t.id = g.tarjeta_id
                                  LEFT JOIN cuentas cu ON cu.id = g.cuenta_id"""),
        "prestamos": ("nombre,institucion,monto_original,saldo_inicial,cuota_mensual,tasa_interes,dia_pago,fecha_inicio,activo",
                      """SELECT nombre, institucion, monto_original, saldo_inicial, cuota_mensual,
                                tasa_interes, dia_pago, fecha_inicio, activo FROM prestamos"""),
        "pagos_prestamos": ("fecha,prestamo,monto,cuenta",
                            """SELECT pp.fecha, pr.nombre, pp.monto, cu.nombre FROM pagos_prestamos pp
                               JOIN prestamos pr ON pr.id = pp.prestamo_id
                               LEFT JOIN cuentas cu ON cu.id = pp.cuenta_id ORDER BY pp.fecha"""),
        "visacuotas": ("descripcion,tarjeta,monto_total,num_cuotas,cuota_mensual,fecha_inicio,dia_pago,activo",
                       """SELECT v.descripcion, t.nombre, v.monto_total, v.num_cuotas, v.cuota_mensual,
                                 v.fecha_inicio, v.dia_pago, v.activo
                          FROM visacuotas v JOIN tarjetas t ON t.id = v.tarjeta_id"""),
        "pagos_visacuotas": ("fecha,visacuota,monto,cuenta",
                             """SELECT pv.fecha, v.descripcion, pv.monto, cu.nombre FROM pagos_visacuotas pv
                                JOIN visacuotas v ON v.id = pv.visacuota_id
                                LEFT JOIN cuentas cu ON cu.id = pv.cuenta_id ORDER BY pv.fecha"""),
    }
    encabezado, sql = consultas[tabla]
    return encabezado.split(","), conn.execute(sql).fetchall()


@router.get("/api/export")
def exportar_todo():
    """Descarga un ZIP con un CSV por tabla (mismo formato que acepta la importación)."""
    conn = db.get_conn()
    try:
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            for tabla in ("categorias", "tarjetas", "cuentas", "ingresos", "gastos",
                          "pagos_tarjetas", "ingresos_recurrentes", "gastos_recurrentes",
                          "prestamos", "pagos_prestamos", "visacuotas", "pagos_visacuotas"):
                encabezado, filas = _query_export(conn, tabla)
                salida = io.StringIO()
                w = csv.writer(salida, lineterminator="\n")
                w.writerow(encabezado)
                for f in filas:
                    w.writerow(list(f))
                zf.writestr(f"{tabla}.csv", salida.getvalue())
        buffer.seek(0)
        nombre = f"finanzas_export_{hoy().isoformat()}.zip"
        return StreamingResponse(buffer, media_type="application/zip",
                                 headers={"Content-Disposition": f"attachment; filename={nombre}"})
    finally:
        conn.close()


@router.post("/api/import/{tabla}")
async def importar_csv(tabla: str, archivo: UploadFile = File(...)):
    """
    Importa un CSV con el mismo formato que la exportación. Valida fila por fila
    y devuelve un resumen: cuántas entraron y cuáles se rechazaron (con motivo).
    """
    if tabla not in ("categorias", "tarjetas", "cuentas", "ingresos", "gastos",
                     "pagos_tarjetas", "ingresos_recurrentes", "gastos_recurrentes",
                     "prestamos", "pagos_prestamos", "visacuotas", "pagos_visacuotas"):
        raise HTTPException(400, f"Tabla desconocida: {tabla}")

    contenido = (await archivo.read()).decode("utf-8-sig")  # tolera BOM de Excel
    lector = csv.DictReader(io.StringIO(contenido))
    conn = db.get_conn()
    importados, rechazados = 0, []
    try:
        # Mapas de nombre -> id para resolver referencias
        cats = {(c["nombre"].lower(), c["tipo"]): c["id"]
                for c in conn.execute("SELECT * FROM categorias")}
        tars = {t["nombre"].lower(): t["id"] for t in conn.execute("SELECT * FROM tarjetas")}
        ctas = {c["nombre"].lower(): c["id"] for c in conn.execute("SELECT * FROM cuentas")}
        pres = {p["nombre"].lower(): p["id"] for p in conn.execute("SELECT * FROM prestamos")}
        vcs = {v["descripcion"].lower(): v["id"] for v in conn.execute("SELECT * FROM visacuotas")}
        metodos_fijos = {m.lower(): m for m in db.METODOS_FIJOS}
        metodos_fijos["debito"] = "Débito"  # tolerar sin tilde

        def cuenta_de(fila):
            """Resuelve la columna opcional 'cuenta' de un CSV (None si viene vacía)."""
            nombre = fila.get("cuenta", "")
            if not nombre:
                return None
            cid = ctas.get(nombre.lower())
            if not cid:
                raise ValueError(f"cuenta desconocida: '{nombre}'")
            return cid

        for num, fila in enumerate(lector, start=2):  # fila 1 es el encabezado
            try:
                fila = {(k or "").strip().lower(): (v or "").strip() for k, v in fila.items()}

                if tabla == "gastos":
                    fecha = validar_fecha(fila["fecha"])
                    monto = validar_monto(fila["monto"])
                    cat_id = cats.get((fila["categoria"].lower(), "gasto"))
                    if not cat_id:
                        raise ValueError(f"categoría de gasto desconocida: '{fila['categoria']}'")
                    met = fila["metodo"]
                    if met.lower() in metodos_fijos:
                        conn.execute(
                            "INSERT INTO gastos (fecha, descripcion, categoria_id, metodo, cuenta_id, monto) "
                            "VALUES (?, ?, ?, ?, ?, ?)",
                            (fecha, fila.get("descripcion", ""), cat_id,
                             metodos_fijos[met.lower()], cuenta_de(fila), monto))
                    elif met.lower() in tars:
                        conn.execute(
                            "INSERT INTO gastos (fecha, descripcion, categoria_id, metodo, tarjeta_id, monto) "
                            "VALUES (?, ?, ?, 'Tarjeta', ?, ?)",
                            (fecha, fila.get("descripcion", ""), cat_id, tars[met.lower()], monto))
                    else:
                        raise ValueError(f"método/tarjeta desconocido: '{met}'")

                elif tabla == "ingresos":
                    cat_id = cats.get((fila["categoria"].lower(), "ingreso"))
                    if not cat_id:
                        raise ValueError(f"categoría de ingreso desconocida: '{fila['categoria']}'")
                    conn.execute(
                        "INSERT INTO ingresos (fecha, descripcion, categoria_id, monto, cuenta_id) "
                        "VALUES (?, ?, ?, ?, ?)",
                        (validar_fecha(fila["fecha"]), fila.get("descripcion", ""),
                         cat_id, validar_monto(fila["monto"]), cuenta_de(fila)))

                elif tabla == "pagos_tarjetas":
                    tid = tars.get(fila["tarjeta"].lower())
                    if not tid:
                        raise ValueError(f"tarjeta desconocida: '{fila['tarjeta']}'")
                    conn.execute(
                        "INSERT INTO pagos_tarjetas (fecha, tarjeta_id, cuenta_id, monto) "
                        "VALUES (?, ?, ?, ?)",
                        (validar_fecha(fila["fecha"]), tid, cuenta_de(fila),
                         validar_monto(fila["monto"])))

                elif tabla == "cuentas":
                    if fila["nombre"].lower() in ctas:
                        raise ValueError(f"ya existe la cuenta '{fila['nombre']}'")
                    if fila["tipo"] not in ("Monetaria", "Ahorro"):
                        raise ValueError(f"tipo de cuenta inválido: '{fila['tipo']}' (Monetaria o Ahorro)")
                    conn.execute(
                        "INSERT INTO cuentas (banco, nombre, tipo, saldo_inicial, activa) "
                        "VALUES (?, ?, ?, ?, ?)",
                        (fila["banco"], fila["nombre"], fila["tipo"],
                         float(fila.get("saldo_inicial", "0") or 0),
                         int(fila.get("activa", "1") or 1)))
                    ctas = {c["nombre"].lower(): c["id"] for c in conn.execute("SELECT * FROM cuentas")}

                elif tabla == "categorias":
                    if fila["tipo"] not in ("ingreso", "gasto"):
                        raise ValueError(f"tipo inválido: '{fila['tipo']}'")
                    conn.execute(
                        "INSERT OR IGNORE INTO categorias (nombre, tipo, activa) VALUES (?, ?, ?)",
                        (fila["nombre"], fila["tipo"], int(fila.get("activa", "1") or 1)))
                    # refrescar mapa por si se usa en el mismo archivo
                    cats = {(c["nombre"].lower(), c["tipo"]): c["id"]
                            for c in conn.execute("SELECT * FROM categorias")}

                elif tabla == "tarjetas":
                    if fila["nombre"].lower() in tars:
                        raise ValueError(f"ya existe la tarjeta '{fila['nombre']}'")
                    # Valores del resumen: opcionales, None si la celda viene vacía
                    # o si el CSV es viejo y no trae esas columnas.
                    resumen = tuple(float(fila[c]) if fila.get(c) else None
                                    for c in ("saldo_dia", "saldo_corte", "pago_contado"))
                    # marca: opcional y tolerante con CSV viejos (columna ausente
                    # o vacía -> None); si viene con basura, se rechaza el archivo
                    # en vez de guardar una red inválida.
                    marca = fila.get("marca") or None
                    if marca is not None and marca not in ("Visa", "Mastercard"):
                        raise ValueError(f"marca inválida en la tarjeta '{fila['nombre']}': '{marca}'")
                    conn.execute(
                        "INSERT INTO tarjetas (banco, nombre, limite, dia_corte, dia_pago, saldo_inicial, "
                        "activa, marca, saldo_dia, saldo_corte, pago_contado, resumen_actualizado) "
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        (fila["banco"], fila["nombre"], validar_monto(fila["limite"]),
                         int(fila["dia_corte"]), int(fila["dia_pago"]),
                         float(fila.get("saldo_inicial", "0") or 0),
                         int(fila.get("activa", "1") or 1), marca,
                         *resumen, fila.get("resumen_actualizado") or None))
                    tars = {t["nombre"].lower(): t["id"] for t in conn.execute("SELECT * FROM tarjetas")}

                elif tabla == "ingresos_recurrentes":
                    cat_id = cats.get((fila["categoria"].lower(), "ingreso"))
                    if not cat_id:
                        raise ValueError(f"categoría de ingreso desconocida: '{fila['categoria']}'")
                    frec = fila.get("frecuencia", "") or "Mensual"
                    if frec not in ("Mensual", "Quincenal", "Anual"):
                        raise ValueError(
                            f"frecuencia inválida: '{frec}' (Mensual, Quincenal o Anual)")
                    dia2 = int(fila["dia_mes_2"]) if fila.get("dia_mes_2") else None
                    if frec == "Quincenal" and not dia2:
                        raise ValueError("frecuencia Quincenal requiere la columna dia_mes_2")
                    # mes_1/mes_2 solo aplican a Anual; en un CSV viejo la
                    # columna no existe y quedan en None, que es lo correcto
                    # para Mensual/Quincenal.
                    mes1 = int(fila["mes_1"]) if fila.get("mes_1") else None
                    mes2 = int(fila["mes_2"]) if fila.get("mes_2") else None
                    if frec == "Anual":
                        if not mes1:
                            raise ValueError("frecuencia Anual requiere la columna mes_1 (1-12)")
                    else:
                        mes1 = mes2 = None
                    conn.execute(
                        "INSERT INTO ingresos_recurrentes "
                        "(descripcion, categoria_id, monto, dia_mes, frecuencia, dia_mes_2, "
                        "mes_1, mes_2, activo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        (fila["descripcion"], cat_id, validar_monto(fila["monto"]),
                         int(fila["dia_mes"]), frec, dia2, mes1, mes2,
                         int(fila.get("activo", "1") or 1)))

                elif tabla == "gastos_recurrentes":
                    cat_id = cats.get((fila["categoria"].lower(), "gasto"))
                    if not cat_id:
                        raise ValueError(f"categoría de gasto desconocida: '{fila['categoria']}'")
                    frec = fila.get("frecuencia", "") or "Mensual"
                    if frec not in ("Mensual", "Quincenal", "Anual"):
                        raise ValueError(
                            f"frecuencia inválida: '{frec}' (Mensual, Quincenal o Anual)")
                    dia2 = int(fila["dia_mes_2"]) if fila.get("dia_mes_2") else None
                    if frec == "Quincenal" and not dia2:
                        raise ValueError("frecuencia Quincenal requiere la columna dia_mes_2")
                    # mes_1/mes_2 solo aplican a Anual; en un CSV viejo la
                    # columna no existe y quedan en None, que es lo correcto.
                    mes1 = int(fila["mes_1"]) if fila.get("mes_1") else None
                    mes2 = int(fila["mes_2"]) if fila.get("mes_2") else None
                    if frec == "Anual":
                        if not mes1:
                            raise ValueError("frecuencia Anual requiere la columna mes_1 (1-12)")
                    else:
                        mes1 = mes2 = None
                    met = fila.get("metodo", "") or "Efectivo"
                    tid = None
                    if met.lower() in metodos_fijos:
                        met = metodos_fijos[met.lower()]
                    elif met.lower() in tars:
                        tid, met = tars[met.lower()], "Tarjeta"
                    else:
                        raise ValueError(f"método/tarjeta desconocido: '{met}'")
                    conn.execute(
                        "INSERT INTO gastos_recurrentes "
                        "(descripcion, categoria_id, monto, dia_mes, frecuencia, dia_mes_2, "
                        " mes_1, mes_2, metodo, tarjeta_id, cuenta_id, activo) "
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        (fila["descripcion"], cat_id, validar_monto(fila["monto"]),
                         int(fila["dia_mes"]), frec, dia2, mes1, mes2, met, tid,
                         cuenta_de(fila), int(fila.get("activo", "1") or 1)))

                elif tabla == "prestamos":
                    if fila["nombre"].lower() in pres:
                        raise ValueError(f"ya existe el préstamo '{fila['nombre']}'")
                    conn.execute(
                        "INSERT INTO prestamos (nombre, institucion, monto_original, saldo_inicial, "
                        "cuota_mensual, tasa_interes, dia_pago, fecha_inicio, activo) "
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        (fila["nombre"], fila["institucion"], validar_monto(fila["monto_original"]),
                         float(fila.get("saldo_inicial", "0") or 0), validar_monto(fila["cuota_mensual"]),
                         float(fila["tasa_interes"]) if fila.get("tasa_interes") else None,
                         int(fila["dia_pago"]) if fila.get("dia_pago") else None,
                         fila.get("fecha_inicio") or None, int(fila.get("activo", "1") or 1)))
                    pres = {p["nombre"].lower(): p["id"] for p in conn.execute("SELECT * FROM prestamos")}

                elif tabla == "pagos_prestamos":
                    pid = pres.get(fila["prestamo"].lower())
                    if not pid:
                        raise ValueError(f"préstamo desconocido: '{fila['prestamo']}'")
                    conn.execute(
                        "INSERT INTO pagos_prestamos (fecha, prestamo_id, cuenta_id, monto) "
                        "VALUES (?, ?, ?, ?)",
                        (validar_fecha(fila["fecha"]), pid, cuenta_de(fila), validar_monto(fila["monto"])))

                elif tabla == "visacuotas":
                    if fila["descripcion"].lower() in vcs:
                        raise ValueError(f"ya existe la Visa Cuotas '{fila['descripcion']}'")
                    tid = tars.get(fila["tarjeta"].lower())
                    if not tid:
                        raise ValueError(f"tarjeta desconocida: '{fila['tarjeta']}'")
                    conn.execute(
                        "INSERT INTO visacuotas (descripcion, tarjeta_id, monto_total, num_cuotas, "
                        "cuota_mensual, fecha_inicio, dia_pago, activo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                        (fila["descripcion"], tid, validar_monto(fila["monto_total"]), int(fila["num_cuotas"]),
                         validar_monto(fila["cuota_mensual"]), validar_fecha(fila["fecha_inicio"]),
                         int(fila["dia_pago"]) if fila.get("dia_pago") else None,
                         int(fila.get("activo", "1") or 1)))
                    vcs = {v["descripcion"].lower(): v["id"] for v in conn.execute("SELECT * FROM visacuotas")}

                elif tabla == "pagos_visacuotas":
                    vid = vcs.get(fila["visacuota"].lower())
                    if not vid:
                        raise ValueError(f"Visa Cuotas desconocida: '{fila['visacuota']}'")
                    conn.execute(
                        "INSERT INTO pagos_visacuotas (fecha, visacuota_id, cuenta_id, monto) "
                        "VALUES (?, ?, ?, ?)",
                        (validar_fecha(fila["fecha"]), vid, cuenta_de(fila), validar_monto(fila["monto"])))

                importados += 1
            except (HTTPException, ValueError, KeyError) as e:
                detalle = e.detail if isinstance(e, HTTPException) else str(e)
                if isinstance(e, KeyError):
                    detalle = f"falta la columna {e}"
                rechazados.append({"fila": num, "motivo": detalle})

        conn.commit()
        if importados:
            marcar_y_sincronizar(conn)
        return {"importados": importados, "rechazados": rechazados}
    finally:
        conn.close()

