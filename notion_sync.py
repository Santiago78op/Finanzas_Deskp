"""
notion_sync.py — Sincronización en un solo sentido (app -> Notion).

Sube a Notion:
  1. "Resumen del mes": ingresos, gastos, balance, deuda en tarjetas y top 5
     categorías de gasto. Se actualizan las mismas filas (no se acumulan).
  2. "Tarjetas": una fila por tarjeta (upsert por nombre).
  3. "Alertas": avisos generados por la app, con fecha, tipo y estado.

La fuente de verdad SIEMPRE es finanzas.db. Si Notion falla, la app sigue
funcionando y queda la bandera 'sync_pendiente' para reintentar después.
"""

import calendar
import os
from datetime import date, datetime

import requests
from dotenv import load_dotenv

import db

# Cargar variables del archivo .env (junto a este script)
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

NOTION_API = "https://api.notion.com/v1"
NOTION_VERSION = "2022-06-28"
TIMEOUT = 15  # segundos por petición HTTP

MESES_ES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
            "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]


# ---------- Utilidades ----------

def esta_configurado():
    """True si hay token y página padre configurados en el .env."""
    return bool(os.getenv("NOTION_TOKEN")) and bool(os.getenv("NOTION_PARENT_PAGE_ID"))


def verificar_conexion():
    """
    Valida el .env SIN crear ni modificar nada en Notion: confirma que el
    token autentica y que la página padre es visible para la integración.
    Devuelve (ok: bool, mensaje: str) con un diagnóstico legible.
    """
    if not os.getenv("NOTION_TOKEN"):
        return False, "Falta NOTION_TOKEN en el archivo .env"
    if not os.getenv("NOTION_PARENT_PAGE_ID"):
        return False, "Falta NOTION_PARENT_PAGE_ID en el archivo .env"

    # 1) ¿El token autentica?
    r = _get("/users/me")
    if r.status_code == 401:
        return False, "Token inválido o vencido (401). Revisá NOTION_TOKEN en .env."
    if r.status_code != 200:
        return False, f"No se pudo validar el token (HTTP {r.status_code}): {r.text[:200]}"
    nombre_integracion = r.json().get("name", "tu integración")

    # 2) ¿La integración puede ver la página padre?
    page_id = os.getenv("NOTION_PARENT_PAGE_ID")
    r = _get(f"/pages/{page_id}")
    if r.status_code == 404:
        return False, (
            f"Token OK (integración '{nombre_integracion}'), pero la página "
            f"{page_id} no aparece (404). Lo más probable: falta compartirla "
            "con la integración — abrí la página en Notion → menú ··· → "
            "Connections → agregá tu integración."
        )
    if r.status_code != 200:
        return False, f"No se pudo leer la página (HTTP {r.status_code}): {r.text[:200]}"

    titulo = "(sin título)"
    props = r.json().get("properties", {})
    for prop in props.values():
        if prop.get("type") == "title" and prop.get("title"):
            titulo = "".join(t["plain_text"] for t in prop["title"])
            break

    return True, f"Todo listo — integración '{nombre_integracion}' ve la página '{titulo}'"


def _headers():
    return {
        "Authorization": f"Bearer {os.getenv('NOTION_TOKEN')}",
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
    }


def _post(ruta, payload):
    r = requests.post(f"{NOTION_API}{ruta}", headers=_headers(), json=payload, timeout=TIMEOUT)
    return r


def _patch(ruta, payload):
    r = requests.patch(f"{NOTION_API}{ruta}", headers=_headers(), json=payload, timeout=TIMEOUT)
    return r


def _get(ruta):
    r = requests.get(f"{NOTION_API}{ruta}", headers=_headers(), timeout=TIMEOUT)
    return r


def fmt_q(monto):
    """Formatea un monto como Q 1,234.56 (para textos en Notion)."""
    return f"Q {monto:,.2f}"


def _clamp_dia(anio, mes, dia):
    """Ajusta un día al máximo del mes (ej. día 31 en junio -> 30)."""
    return date(anio, mes, min(dia, calendar.monthrange(anio, mes)[1]))


def proxima_fecha(dia_del_mes, desde=None):
    """Próxima ocurrencia (hoy o futura) de un día del mes dado."""
    hoy = desde or date.today()
    f = _clamp_dia(hoy.year, hoy.month, dia_del_mes)
    if f < hoy:
        anio, mes = (hoy.year + 1, 1) if hoy.month == 12 else (hoy.year, hoy.month + 1)
        f = _clamp_dia(anio, mes, dia_del_mes)
    return f


# ---------- Creación / verificación de las bases en Notion ----------

ESQUEMAS = {
    "resumen": {
        "titulo": "Resumen del mes",
        "config_key": "notion_db_resumen",
        "properties": {
            "Concepto": {"title": {}},
            "Valor": {"rich_text": {}},
            "Actualizado": {"date": {}},
        },
    },
    "tarjetas": {
        "titulo": "Tarjetas",
        "config_key": "notion_db_tarjetas",
        "properties": {
            "Tarjeta": {"title": {}},
            "Banco": {"rich_text": {}},
            "Saldo": {"number": {"format": "number_with_commas"}},
            "Disponible": {"number": {"format": "number_with_commas"}},
            "% Uso": {"number": {"format": "number_with_commas"}},
            "Próximo corte": {"date": {}},
            "Próximo pago": {"date": {}},
        },
    },
    "alertas": {
        "titulo": "Alertas",
        "config_key": "notion_db_alertas",
        "properties": {
            "Alerta": {"title": {}},
            "Fecha": {"date": {}},
            "Tipo": {"select": {"options": [
                {"name": "tarjeta", "color": "orange"},
                {"name": "balance", "color": "red"},
                {"name": "ritmo", "color": "yellow"},
            ]}},
            "Estado": {"select": {"options": [
                {"name": "Pendiente", "color": "red"},
                {"name": "Vista", "color": "green"},
            ]}},
        },
    },
}


def _asegurar_base(conn, clave_esquema):
    """Devuelve el ID de la base en Notion; la crea si no existe o fue borrada."""
    esquema = ESQUEMAS[clave_esquema]
    db_id = db.config_get(conn, esquema["config_key"])

    # Verificar que la base guardada siga existiendo en Notion
    if db_id:
        r = _get(f"/databases/{db_id}")
        if r.status_code == 200 and not r.json().get("archived"):
            return db_id
        db_id = None  # fue borrada/archivada: crear de nuevo

    payload = {
        "parent": {"type": "page_id", "page_id": os.getenv("NOTION_PARENT_PAGE_ID")},
        "title": [{"type": "text", "text": {"content": esquema["titulo"]}}],
        "properties": esquema["properties"],
    }
    r = _post("/databases", payload)
    r.raise_for_status()
    db_id = r.json()["id"]
    db.config_set(conn, esquema["config_key"], db_id)
    # El mapa de páginas viejo ya no sirve si la base es nueva
    conn.execute("DELETE FROM notion_map WHERE tipo = ?", (clave_esquema,))
    conn.commit()
    return db_id


def _upsert_pagina(conn, tipo, clave, db_id, propiedades, props_solo_crear=None):
    """
    Crea o actualiza una página de Notion identificada localmente por (tipo, clave).
    props_solo_crear: propiedades que solo se fijan al crear (ej. Estado de alerta,
    para no pisar el 'Vista' que el usuario marcó desde el celular).
    """
    fila = conn.execute(
        "SELECT page_id FROM notion_map WHERE tipo = ? AND clave = ?", (tipo, clave)
    ).fetchone()

    if fila:
        r = _patch(f"/pages/{fila['page_id']}", {"properties": propiedades})
        if r.status_code == 200:
            return
        # Si la página fue borrada en Notion, se limpia el mapa y se recrea
        conn.execute("DELETE FROM notion_map WHERE tipo = ? AND clave = ?", (tipo, clave))
        conn.commit()

    todas = dict(propiedades)
    if props_solo_crear:
        todas.update(props_solo_crear)
    r = _post("/pages", {"parent": {"database_id": db_id}, "properties": todas})
    r.raise_for_status()
    conn.execute(
        "INSERT OR REPLACE INTO notion_map (tipo, clave, page_id) VALUES (?, ?, ?)",
        (tipo, clave, r.json()["id"]),
    )
    conn.commit()


# ---------- Datos del mes ----------

def datos_del_mes(conn, anio=None, mes=None):
    """Calcula los totales del mes que se suben al resumen de Notion."""
    hoy = date.today()
    anio, mes = anio or hoy.year, mes or hoy.month
    ym = f"{anio:04d}-{mes:02d}"

    ingresos = conn.execute(
        "SELECT COALESCE(SUM(monto),0) t FROM ingresos WHERE strftime('%Y-%m', fecha) = ?", (ym,)
    ).fetchone()["t"]
    gastos = conn.execute(
        "SELECT COALESCE(SUM(monto),0) t FROM gastos WHERE strftime('%Y-%m', fecha) = ?", (ym,)
    ).fetchone()["t"]
    pagos = conn.execute(
        "SELECT COALESCE(SUM(monto),0) t FROM pagos_tarjetas WHERE strftime('%Y-%m', fecha) = ?", (ym,)
    ).fetchone()["t"]

    deuda_total = 0.0
    for t in conn.execute("SELECT id FROM tarjetas WHERE activa = 1").fetchall():
        deuda_total += db.saldo_tarjeta(conn, t["id"])

    # Dinero disponible: suma de saldos de las cuentas activas (Monetaria/Ahorro)
    dinero_total = 0.0
    for c in conn.execute("SELECT id FROM cuentas WHERE activa = 1").fetchall():
        dinero_total += db.saldo_cuenta(conn, c["id"])

    top = conn.execute(
        """SELECT c.nombre, SUM(g.monto) total
           FROM gastos g JOIN categorias c ON c.id = g.categoria_id
           WHERE strftime('%Y-%m', g.fecha) = ?
           GROUP BY c.nombre ORDER BY total DESC LIMIT 5""",
        (ym,),
    ).fetchall()

    return {
        "anio": anio, "mes": mes,
        "ingresos": round(ingresos, 2),
        "gastos": round(gastos, 2),
        "balance": round(ingresos - gastos, 2),
        "pagos_tarjetas": round(pagos, 2),
        "deuda_total": round(deuda_total, 2),
        "dinero_total": round(dinero_total, 2),
        "top_categorias": [(f["nombre"], round(f["total"], 2)) for f in top],
    }


# ---------- Generación de alertas ----------

def generar_alertas(conn):
    """
    Genera la lista de alertas vigentes. Cada una lleva una 'clave' estable
    (tipo + referencia + mes) para hacer upsert en Notion sin duplicar.
    """
    hoy = date.today()
    ym = hoy.strftime("%Y-%m")
    datos = datos_del_mes(conn)
    alertas = []

    # 1) Pagos de tarjeta próximos (5 días o menos) con saldo pendiente
    for t in conn.execute("SELECT * FROM tarjetas WHERE activa = 1").fetchall():
        saldo = db.saldo_tarjeta(conn, t["id"])
        if saldo <= 0:
            continue
        fpago = proxima_fecha(t["dia_pago"])
        dias = (fpago - hoy).days
        if dias <= 5:
            cuando = "HOY" if dias == 0 else (f"en {dias} día" + ("s" if dias > 1 else ""))
            alertas.append({
                "clave": f"pago-{t['nombre']}-{fpago.isoformat()}",
                "tipo": "tarjeta",
                "mensaje": f"Pago de {t['nombre']} vence {cuando} (saldo {fmt_q(saldo)})",
            })

    # 2) Balance del mes negativo
    if datos["balance"] < 0:
        alertas.append({
            "clave": f"balance-negativo-{ym}",
            "tipo": "balance",
            "mensaje": f"Este mes llevás balance negativo ({fmt_q(datos['balance'])})",
        })

    # 2b) La deuda en tarjetas rebasa los ingresos del mes
    if datos["ingresos"] > 0 and datos["deuda_total"] > datos["ingresos"]:
        alertas.append({
            "clave": f"deuda-supera-ingresos-{ym}",
            "tipo": "balance",
            "mensaje": (f"Tu deuda en tarjetas ({fmt_q(datos['deuda_total'])}) rebasa "
                        f"tus ingresos del mes ({fmt_q(datos['ingresos'])})"),
        })

    # 3) Ritmo de gasto: proyección a fin de mes vs ingresos del mes
    dias_mes = calendar.monthrange(hoy.year, hoy.month)[1]
    if hoy.day >= 5 and datos["ingresos"] > 0 and datos["gastos"] > 0:
        proyeccion = datos["gastos"] / hoy.day * dias_mes
        if proyeccion > datos["ingresos"]:
            alertas.append({
                "clave": f"ritmo-{ym}",
                "tipo": "ritmo",
                "mensaje": (f"Al ritmo actual gastarías {fmt_q(proyeccion)} este mes, "
                            f"más que tus ingresos ({fmt_q(datos['ingresos'])})"),
            })

    return alertas


# ---------- Sincronización completa ----------

def sincronizar(conn):
    """
    Sube todo a Notion. Lanza excepción si algo falla (el que llama decide
    si la ignora); si termina bien, limpia la bandera de sync pendiente.
    """
    if not esta_configurado():
        raise RuntimeError("Notion no está configurado (revisá el archivo .env)")

    hoy = date.today()
    datos = datos_del_mes(conn)

    # --- 1. Resumen del mes (upsert por concepto, sin duplicar filas) ---
    db_resumen = _asegurar_base(conn, "resumen")
    filas = [
        ("Mes", f"{MESES_ES[datos['mes']]} {datos['anio']}"),
        ("Ingresos del mes", fmt_q(datos["ingresos"])),
        ("Gastos del mes", fmt_q(datos["gastos"])),
        ("Balance del mes", fmt_q(datos["balance"])),
        ("Deuda total en tarjetas", fmt_q(datos["deuda_total"])),
        ("Dinero en cuentas", fmt_q(datos["dinero_total"])),
        ("Patrimonio (cuentas − deuda)", fmt_q(datos["dinero_total"] - datos["deuda_total"])),
    ]
    for i in range(5):
        if i < len(datos["top_categorias"]):
            nombre, total = datos["top_categorias"][i]
            filas.append((f"Top {i + 1} categoría de gasto", f"{nombre}: {fmt_q(total)}"))
        else:
            filas.append((f"Top {i + 1} categoría de gasto", "—"))

    for concepto, valor in filas:
        _upsert_pagina(conn, "resumen", concepto, db_resumen, {
            "Concepto": {"title": [{"text": {"content": concepto}}]},
            "Valor": {"rich_text": [{"text": {"content": valor}}]},
            "Actualizado": {"date": {"start": hoy.isoformat()}},
        })

    # --- 2. Tarjetas (upsert por nombre) ---
    db_tarjetas = _asegurar_base(conn, "tarjetas")
    for t in conn.execute("SELECT * FROM tarjetas WHERE activa = 1").fetchall():
        saldo = db.saldo_tarjeta(conn, t["id"])
        disponible = round(t["limite"] - saldo, 2)
        pct = round(saldo / t["limite"] * 100, 1) if t["limite"] else 0
        _upsert_pagina(conn, "tarjetas", t["nombre"], db_tarjetas, {
            "Tarjeta": {"title": [{"text": {"content": t["nombre"]}}]},
            "Banco": {"rich_text": [{"text": {"content": t["banco"]}}]},
            "Saldo": {"number": saldo},
            "Disponible": {"number": disponible},
            "% Uso": {"number": pct},
            "Próximo corte": {"date": {"start": proxima_fecha(t["dia_corte"]).isoformat()}},
            "Próximo pago": {"date": {"start": proxima_fecha(t["dia_pago"]).isoformat()}},
        })

    # --- 3. Alertas (upsert por clave; el Estado solo se fija al crear,
    #        así lo que marqués como "Vista" desde el celular se respeta) ---
    db_alertas = _asegurar_base(conn, "alertas")
    for a in generar_alertas(conn):
        _upsert_pagina(
            conn, "alerta", a["clave"], db_alertas,
            {
                "Alerta": {"title": [{"text": {"content": a["mensaje"]}}]},
                "Fecha": {"date": {"start": hoy.isoformat()}},
                "Tipo": {"select": {"name": a["tipo"]}},
            },
            props_solo_crear={"Estado": {"select": {"name": "Pendiente"}}},
        )

    # Todo salió bien: limpiar bandera y registrar la hora
    db.config_set(conn, "sync_pendiente", "0")
    db.config_set(conn, "ultima_sync", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    return {"ok": True, "resumen": datos, "alertas": len(generar_alertas(conn))}
