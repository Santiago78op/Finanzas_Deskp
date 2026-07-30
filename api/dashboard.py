"""
El dashboard: una sola respuesta con todo lo que pinta la portada.
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

import calendar
import notion_sync
from api import cuentas as mod_cuentas
from api.prestamos import (
    CAMPOS_PRESTAMO, CAMPOS_VISACUOTA, _prestamo_con_saldo, _visacuota_con_saldo,
)
from api.tarjetas import CAMPOS as CAMPOS_TARJETA, _tarjeta_con_saldo

router = APIRouter()


@router.get("/api/dashboard")
def dashboard(anio: Optional[int] = None, mes: Optional[int] = None):
    hoy_ = comun.hoy()
    anio, mes = anio or hoy_.year, mes or hoy_.month
    ym = f"{anio:04d}-{mes:02d}"
    conn = db.get_conn()
    try:
        datos = notion_sync.datos_del_mes(conn, anio, mes)
        pagos_mes = datos["pagos_tarjetas"]

        # Métrica clave del asalariado: qué queda del salario del mes
        disponible_salario = round(datos["ingresos"] - datos["gastos"] - pagos_mes, 2)

        # Días hasta el próximo ingreso recurrente (el día de cobro más cercano,
        # contando ambos días de los quincenales).
        #
        # Los anuales quedan FUERA: proxima_fecha() razona en día-del-mes, así
        # que un Bono 14 del día 15 se leería como "cobrás el 15 del mes que
        # viene" cuando en realidad falta casi un año. Y aunque se calculara
        # bien, un bono anual nunca es "el próximo sueldo" — el mensual o
        # quincenal siempre cae antes.
        dias_salario = None
        for rec in conn.execute(
            "SELECT dia_mes, frecuencia, dia_mes_2 FROM ingresos_recurrentes "
            "WHERE activo = 1 AND frecuencia != 'Anual'"
        ).fetchall():
            dias = [rec["dia_mes"]]
            if rec["frecuencia"] == "Quincenal" and rec["dia_mes_2"]:
                dias.append(rec["dia_mes_2"])
            for dia in dias:
                d_falta = (notion_sync.proxima_fecha(dia) - hoy_).days
                if dias_salario is None or d_falta < dias_salario:
                    dias_salario = d_falta

        # Barras: ingresos vs gastos por mes del año seleccionado
        barras = {"labels": [MESES_ES[m][:3].capitalize() for m in range(1, 13)],
                  "ingresos": [0.0] * 12, "gastos": [0.0] * 12}
        for f in conn.execute(
            "SELECT strftime('%m', fecha) m, SUM(monto) t FROM ingresos "
            "WHERE strftime('%Y', fecha) = ? GROUP BY m", (str(anio),)
        ):
            barras["ingresos"][int(f["m"]) - 1] = round(f["t"], 2)
        for f in conn.execute(
            "SELECT strftime('%m', fecha) m, SUM(monto) t FROM gastos "
            "WHERE strftime('%Y', fecha) = ? GROUP BY m", (str(anio),)
        ):
            barras["gastos"][int(f["m"]) - 1] = round(f["t"], 2)

        # Pastel: gastos por categoría del mes
        pastel = {"labels": [], "datos": []}
        top_cat_ids = []
        for f in conn.execute(
            """SELECT c.id, c.nombre, SUM(g.monto) t FROM gastos g
               JOIN categorias c ON c.id = g.categoria_id
               WHERE strftime('%Y-%m', g.fecha) = ? GROUP BY c.id ORDER BY t DESC""", (ym,)
        ):
            pastel["labels"].append(f["nombre"])
            pastel["datos"].append(round(f["t"], 2))
            top_cat_ids.append((f["id"], f["nombre"]))

        # Dona: gastos por método de pago del mes (cada tarjeta se muestra por su nombre)
        metodo_pago = {"labels": [], "datos": []}
        for f in conn.execute(
            """SELECT CASE WHEN g.metodo = 'Tarjeta' THEN t.nombre ELSE g.metodo END AS etiqueta,
                      SUM(g.monto) t
               FROM gastos g LEFT JOIN tarjetas t ON t.id = g.tarjeta_id
               WHERE strftime('%Y-%m', g.fecha) = ? GROUP BY etiqueta ORDER BY t DESC""", (ym,)
        ):
            metodo_pago["labels"].append(f["etiqueta"])
            metodo_pago["datos"].append(round(f["t"], 2))

        # Evolución del patrimonio: últimos 12 meses terminando en el mes seleccionado
        patrimonio_hist = {"labels": [], "datos": []}
        for i in range(11, -1, -1):
            y, m = anio, mes - i
            while m < 1:
                m += 12; y -= 1
            ym_i = f"{y:04d}-{m:02d}"
            patrimonio_hist["labels"].append(f"{MESES_ES[m][:3].capitalize()} {str(y)[2:]}")
            patrimonio_hist["datos"].append(
                round(db.saldo_cuentas_hasta(conn, ym_i) - db.saldo_tarjetas_hasta(conn, ym_i), 2))

        # Tendencia: gasto mensual de las 3 categorías top del mes, últimos 6 meses
        top3 = top_cat_ids[:3]
        tendencia_categorias = {"labels": [], "series": [{"nombre": nombre, "datos": []} for _, nombre in top3]}
        meses_tendencia = []
        for i in range(5, -1, -1):
            y, m = anio, mes - i
            while m < 1:
                m += 12; y -= 1
            meses_tendencia.append((y, m))
            tendencia_categorias["labels"].append(f"{MESES_ES[m][:3].capitalize()} {str(y)[2:]}")
        for idx, (cat_id, _) in enumerate(top3):
            gasto_por_mes = {f["ym"]: f["t"] for f in conn.execute(
                """SELECT strftime('%Y-%m', fecha) ym, SUM(monto) t FROM gastos
                   WHERE categoria_id = ? GROUP BY ym""", (cat_id,))}
            for y, m in meses_tendencia:
                ym_i = f"{y:04d}-{m:02d}"
                tendencia_categorias["series"][idx]["datos"].append(round(gasto_por_mes.get(ym_i, 0), 2))

        tarjetas = [_tarjeta_con_saldo(conn, t)
                    for t in conn.execute(f"SELECT {CAMPOS_TARJETA} FROM tarjetas WHERE activa = 1 ORDER BY nombre")]

        # Cuentas de dinero: cuánto tenés en total y por cuenta
        cuentas = [mod_cuentas.con_saldo(conn, c)
                   for c in conn.execute(f"SELECT {mod_cuentas.CAMPOS} FROM cuentas WHERE activa = 1 ORDER BY banco, nombre")]
        dinero_total = round(sum(c["saldo"] for c in cuentas), 2)
        apartado_ahorros = db.total_apartado(conn)

        # --- Análisis del mes: en qué gastás más y cómo cambió vs el mes anterior ---
        anio_ant, mes_ant = (anio - 1, 12) if mes == 1 else (anio, mes - 1)
        ym_ant = f"{anio_ant:04d}-{mes_ant:02d}"
        gasto_ant_por_cat = {f["nombre"]: f["t"] for f in conn.execute(
            """SELECT c.nombre, SUM(g.monto) t FROM gastos g
               JOIN categorias c ON c.id = g.categoria_id
               WHERE strftime('%Y-%m', g.fecha) = ? GROUP BY c.nombre""", (ym_ant,))}

        top_categorias = []
        for nombre, total in zip(pastel["labels"][:5], pastel["datos"][:5]):
            anterior = gasto_ant_por_cat.get(nombre, 0)
            top_categorias.append({
                "nombre": nombre, "total": total,
                "pct": round(total / datos["gastos"] * 100, 1) if datos["gastos"] else 0,
                "anterior": round(anterior, 2),
                # variación vs mes anterior (None si el mes pasado no hubo gasto ahí)
                "variacion_pct": round((total - anterior) / anterior * 100, 1) if anterior else None,
            })

        top_gastos = [dict(f) for f in conn.execute(
            """SELECT g.fecha, g.descripcion, g.monto, c.nombre AS categoria
               FROM gastos g JOIN categorias c ON c.id = g.categoria_id
               WHERE strftime('%Y-%m', g.fecha) = ?
               ORDER BY g.monto DESC LIMIT 5""", (ym,))]

        # --- Préstamos y Visa Cuotas: nivel real de endeudamiento y de pagos ---
        prestamos = [_prestamo_con_saldo(conn, p)
                     for p in conn.execute(f"SELECT {CAMPOS_PRESTAMO} FROM prestamos WHERE activo = 1 ORDER BY nombre")]
        visacuotas = [_visacuota_con_saldo(conn, v)
                      for v in conn.execute(f"SELECT {CAMPOS_VISACUOTA} FROM visacuotas WHERE activo = 1 ORDER BY descripcion")]

        deuda_prestamos = round(sum(p["saldo"] for p in prestamos), 2)
        deuda_visacuotas = round(sum(v["saldo"] for v in visacuotas), 2)
        pago_mensual_prestamos = round(sum(p["cuota_mensual"] for p in prestamos), 2)
        # una Visa Cuotas ya terminada (sin cuotas restantes) no sigue pesando en el pago mensual
        pago_mensual_visacuotas = round(
            sum(v["cuota_mensual"] for v in visacuotas if v["cuotas_restantes"] > 0), 2)

        # Ingreso mensual de referencia: la regla de normalización vive en
        # db.ingreso_mensual_recurrente (estaba copiada acá y en la capacidad
        # de ahorro).
        ingreso_mensual_ref = db.ingreso_mensual_recurrente(conn)

        endeudamiento = {
            "tarjetas": datos["deuda_total"],
            "prestamos": deuda_prestamos,
            "visacuotas": deuda_visacuotas,
            "pago_mensual_tarjetas": pagos_mes,
            "pago_mensual_prestamos": pago_mensual_prestamos,
            "pago_mensual_visacuotas": pago_mensual_visacuotas,
            "ingreso_mensual_referencia": round(ingreso_mensual_ref, 2) if ingreso_mensual_ref else None,
        }

        return {
            "anio": anio, "mes": mes,
            "ingresos": datos["ingresos"], "gastos": datos["gastos"],
            "balance": datos["balance"], "deuda_total": datos["deuda_total"],
            "pagos_tarjetas_mes": pagos_mes,
            "disponible_salario": disponible_salario,
            "dias_proximo_salario": dias_salario,
            "dinero_total": dinero_total, "cuentas": cuentas,
            # Ahorros: NO se suman a dinero_total, se restan de él. Un sobre no
            # guarda plata propia, solo etiqueta la que ya está en las cuentas
            # (ver el esquema de `ahorros` en db.py). `libre` puede dar negativo
            # si hay más apartado que dinero: eso es un aviso, no un error.
            "apartado_ahorros": apartado_ahorros,
            "libre_para_gastar": round(dinero_total - apartado_ahorros, 2),
            # Salud financiera: patrimonio = dinero en cuentas − deuda en tarjetas,
            # y bandera de si la deuda rebasa los ingresos del mes
            "patrimonio": round(dinero_total - datos["deuda_total"], 2),
            "deuda_supera_ingresos": datos["deuda_total"] > datos["ingresos"] > 0,
            "analisis": {"top_categorias": top_categorias, "top_gastos": top_gastos,
                         "gastos_mes_anterior": round(sum(gasto_ant_por_cat.values()), 2)},
            "barras": barras, "pastel": pastel, "tarjetas": tarjetas,
            "metodo_pago": metodo_pago, "patrimonio_hist": patrimonio_hist,
            "tendencia_categorias": tendencia_categorias,
            "prestamos": prestamos, "visacuotas": visacuotas, "endeudamiento": endeudamiento,
        }
    finally:
        conn.close()

