"""
notion_sync.py — Sincronización con Notion.

Sube a Notion (app -> Notion), modelo relacional (una página por fila real):
  1. "Cuentas": una fila por cuenta bancaria activa (upsert por nombre).
  2. "Meses": una fila POR MES con datos (se acumula, nunca se pisa) —
     habilita una vista de Gráfica (Chart) nativa con el historial.
  3. "Tarjetas": una fila por tarjeta (upsert por nombre).
  4. "Gastos" / "Ingresos" / "Pagos de tarjetas": una página por transacción,
     relacionada con su Cuenta/Tarjeta y su Mes. El saldo SIEMPRE lo calcula
     y empuja la app (SQLite es la fuente de verdad); las relaciones son
     para poder navegar/filtrar desde Notion, no recalculan nada. El
     historial ya sincronizado no se re-sube en cada corrida (solo el mes en
     curso y las filas nuevas, acotadas por corrida) para no pegarle a
     cientos de páginas en cada sync.
  5. "Alertas": avisos generados por la app, con fecha, tipo y estado.

Baja de Notion (Notion -> app), único canal de entrada:
  6. "Bandeja de gastos": la anotás desde el celular cuando no tenés la app
     a mano. Cada sincronización la lee, crea el gasto real en la base local
     y archiva la fila en Notion. Las filas con datos inválidos se quedan
     en la bandeja (no se pierden) para que las corrijas.

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

# Portada oficial de Notion (una de las de su galería por defecto — no un
# archivo nuestro, así que no depende de que la app esté prendida ni de
# ningún hosting propio). Navy -> celeste -> crema: combina con el azul de
# la app y no mete rojo (que en finanzas se lee como "números en rojo").
COVER_URL = "https://www.notion.so/images/page-cover/gradients_6.png"

MESES_ES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
            "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]

# Paleta fija para colorear opciones de select en Notion (nunca se re-ciclan
# al azar: mismo orden siempre, como recomienda un buen sistema de color).
COLORES_NOTION = ["blue", "green", "yellow", "orange", "red", "purple", "pink", "brown", "gray"]

ICONOS_ALERTA = {"tarjeta": "💳", "prestamo": "📄", "visacuota": "🛒", "balance": "⚠️", "ritmo": "🏃"}


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
    "cuentas": {
        "titulo": "Cuentas",
        "config_key": "notion_db_cuentas",
        "icono": "🏦",
        "callout": ("🏦 Cuentas", "Tus cuentas bancarias (Monetaria/Ahorro) y su saldo actual."),
        "properties": {
            "Cuenta": {"title": {}},
            "Banco": {"rich_text": {}},
            "Tipo": {"select": {"options": [
                {"name": "Monetaria", "color": "blue"},
                {"name": "Ahorro", "color": "green"},
            ]}},
            "Saldo": {"number": {"format": "number_with_commas"}},
        },
    },
    "meses": {
        "titulo": "Meses",
        "config_key": "notion_db_meses",
        "icono": "📅",
        "callout": ("📅 Meses", "Historial mensual: ingresos, gastos, balance y patrimonio. "
                                 "Agregale una vista de Gráfica (Chart) para ver la tendencia."),
        "properties": {
            "Mes": {"title": {}},
            "Ingresos": {"number": {"format": "number_with_commas"}},
            "Gastos": {"number": {"format": "number_with_commas"}},
            "Balance": {"number": {"format": "number_with_commas"}},
            "Deuda en tarjetas": {"number": {"format": "number_with_commas"}},
            "Dinero en cuentas": {"number": {"format": "number_with_commas"}},
            "Patrimonio": {"number": {"format": "number_with_commas"}},
            "Top categorías": {"rich_text": {}},
            "Actualizado": {"date": {}},
        },
    },
    "tarjetas": {
        "titulo": "Tarjetas",
        "config_key": "notion_db_tarjetas",
        "icono": "💳",
        "callout": ("💳 Tarjetas", "Tus tarjetas de crédito: saldo, disponible y próximas fechas de corte/pago."),
        "properties": {
            "Tarjeta": {"title": {}},
            "Banco": {"rich_text": {}},
            "Saldo": {"number": {"format": "number_with_commas"}},
            "Disponible": {"number": {"format": "number_with_commas"}},
            "% Uso": {"number": {"format": "percent"}},
            "Próximo corte": {"date": {}},
            "Próximo pago": {"date": {}},
        },
    },
    "prestamos": {
        "titulo": "Préstamos",
        "config_key": "notion_db_prestamos",
        "icono": "📄",
        "callout": ("📄 Préstamos", "Préstamos de banco/financiera: saldo pendiente, cuota mensual y próximo pago."),
        "properties": {
            "Préstamo": {"title": {}},
            "Institución": {"rich_text": {}},
            "Saldo pendiente": {"number": {"format": "number_with_commas"}},
            "Cuota mensual": {"number": {"format": "number_with_commas"}},
            "% Pagado": {"number": {"format": "percent"}},
            "Próximo pago": {"date": {}},
        },
    },
    "visacuotas": {
        "titulo": "Visa Cuotas",
        "config_key": "notion_db_visacuotas",
        "icono": "🛒",
        "callout": ("🛒 Visa Cuotas", "Compras diferidas a cuotas fijas: saldo pendiente, cuotas y tarjeta asociada."),
        "properties": lambda conn: {
            "Visa Cuotas": {"title": {}},
            "Saldo pendiente": {"number": {"format": "number_with_commas"}},
            "Cuota mensual": {"number": {"format": "number_with_commas"}},
            "Cuotas": {"rich_text": {}},
            "Próximo pago": {"date": {}},
            "Tarjeta": {"relation": {"database_id": db.config_get(conn, "notion_db_tarjetas"), "dual_property": {}}},
        },
    },
    "alertas": {
        "titulo": "Alertas",
        "config_key": "notion_db_alertas",
        "icono": "🔔",
        "callout": ("🔔 Alertas", "Avisos automáticos: pagos próximos, balance negativo o ritmo de gasto alto."),
        "properties": {
            "Alerta": {"title": {}},
            "Fecha": {"date": {}},
            "Tipo": {"select": {"options": [
                {"name": "tarjeta", "color": "orange"},
                {"name": "prestamo", "color": "purple"},
                {"name": "visacuota", "color": "pink"},
                {"name": "balance", "color": "red"},
                {"name": "ritmo", "color": "yellow"},
            ]}},
            "Estado": {"select": {"options": [
                {"name": "Pendiente", "color": "red"},
                {"name": "Vista", "color": "green"},
            ]}},
        },
    },
    "bandeja": {
        "titulo": "Bandeja de gastos",
        "config_key": "notion_db_bandeja",
        "icono": "📥",
        "callout": ("📥 Bandeja de gastos", "Anotá un gasto rápido desde el celular; "
                                            "la próxima sincronización lo pasa a tu base real."),
        "properties": {
            "Gasto": {"title": {}},
            "Monto": {"number": {"format": "number_with_commas"}},
            "Categoría": {"select": {"options": []}},
            "Método": {"select": {"options": []}},
            "Fecha": {"date": {}},
        },
    },
    "gastos_mov": {
        "titulo": "Gastos",
        "config_key": "notion_db_gastos_mov",
        "icono": "💸",
        "callout": ("💸 Gastos", "Cada gasto registrado, relacionado con su cuenta o tarjeta y su mes."),
        "properties": lambda conn: {
            "Descripción": {"title": {}},
            "Monto": {"number": {"format": "number_with_commas"}},
            "Fecha": {"date": {}},
            "Categoría": {"select": {"options": []}},
            "Método": {"select": {"options": []}},
            "Cuenta": {"relation": {"database_id": db.config_get(conn, "notion_db_cuentas"), "dual_property": {}}},
            "Tarjeta": {"relation": {"database_id": db.config_get(conn, "notion_db_tarjetas"), "dual_property": {}}},
            "Mes": {"relation": {"database_id": db.config_get(conn, "notion_db_meses"), "dual_property": {}}},
        },
    },
    "ingresos_mov": {
        "titulo": "Ingresos",
        "config_key": "notion_db_ingresos_mov",
        "icono": "💵",
        "callout": ("💵 Ingresos", "Cada ingreso registrado, relacionado con su cuenta y su mes."),
        "properties": lambda conn: {
            "Descripción": {"title": {}},
            "Monto": {"number": {"format": "number_with_commas"}},
            "Fecha": {"date": {}},
            "Categoría": {"select": {"options": []}},
            "Cuenta": {"relation": {"database_id": db.config_get(conn, "notion_db_cuentas"), "dual_property": {}}},
            "Mes": {"relation": {"database_id": db.config_get(conn, "notion_db_meses"), "dual_property": {}}},
        },
    },
    "pagos_mov": {
        "titulo": "Pagos de tarjetas",
        "config_key": "notion_db_pagos_mov",
        "icono": "🧾",
        "callout": ("🧾 Pagos de tarjetas", "Cada pago hecho a una tarjeta, relacionado con la tarjeta, "
                                            "la cuenta de origen y el mes."),
        "properties": lambda conn: {
            "Descripción": {"title": {}},
            "Monto": {"number": {"format": "number_with_commas"}},
            "Fecha": {"date": {}},
            "Tarjeta": {"relation": {"database_id": db.config_get(conn, "notion_db_tarjetas"), "dual_property": {}}},
            "Cuenta": {"relation": {"database_id": db.config_get(conn, "notion_db_cuentas"), "dual_property": {}}},
            "Mes": {"relation": {"database_id": db.config_get(conn, "notion_db_meses"), "dual_property": {}}},
        },
    },
    "pagos_prestamos_mov": {
        "titulo": "Pagos de préstamos",
        "config_key": "notion_db_pagos_prestamos_mov",
        "icono": "🧾",
        "callout": ("🧾 Pagos de préstamos", "Cada pago hecho a un préstamo, relacionado con el préstamo, "
                                             "la cuenta de origen y el mes."),
        "properties": lambda conn: {
            "Descripción": {"title": {}},
            "Monto": {"number": {"format": "number_with_commas"}},
            "Fecha": {"date": {}},
            "Préstamo": {"relation": {"database_id": db.config_get(conn, "notion_db_prestamos"), "dual_property": {}}},
            "Cuenta": {"relation": {"database_id": db.config_get(conn, "notion_db_cuentas"), "dual_property": {}}},
            "Mes": {"relation": {"database_id": db.config_get(conn, "notion_db_meses"), "dual_property": {}}},
        },
    },
    "pagos_visacuotas_mov": {
        "titulo": "Pagos de Visa Cuotas",
        "config_key": "notion_db_pagos_visacuotas_mov",
        "icono": "🧾",
        "callout": ("🧾 Pagos de Visa Cuotas", "Cada pago hecho a una Visa Cuotas, relacionado con la cuota, "
                                               "la cuenta de origen y el mes."),
        "properties": lambda conn: {
            "Descripción": {"title": {}},
            "Monto": {"number": {"format": "number_with_commas"}},
            "Fecha": {"date": {}},
            "Visa Cuotas": {"relation": {"database_id": db.config_get(conn, "notion_db_visacuotas"), "dual_property": {}}},
            "Cuenta": {"relation": {"database_id": db.config_get(conn, "notion_db_cuentas"), "dual_property": {}}},
            "Mes": {"relation": {"database_id": db.config_get(conn, "notion_db_meses"), "dual_property": {}}},
        },
    },
}


# Opciones de select a mantener sincronizadas por esquema (nombre_propiedad -> valores)
_OPCIONES_SELECT_POR_ESQUEMA = {
    "bandeja": lambda conn: {"Categoría": _categorias_gasto(conn), "Método": _metodos_gasto(conn)},
    "gastos_mov": lambda conn: {"Categoría": _categorias_gasto(conn), "Método": _metodos_gasto(conn)},
    "ingresos_mov": lambda conn: {"Categoría": _categorias_ingreso(conn)},
}


def _asegurar_base(conn, clave_esquema):
    """Devuelve el ID de la base en Notion; la crea si no existe o fue borrada."""
    esquema = ESQUEMAS[clave_esquema]
    db_id = db.config_get(conn, esquema["config_key"])

    # Verificar que la base guardada siga existiendo en Notion
    if db_id:
        r = _get(f"/databases/{db_id}")
        if r.status_code == 200 and not r.json().get("archived"):
            datos = r.json()
            # Ícono: siempre el nuestro (identifica qué base es cuál).
            # Portada: solo si NO tiene ninguna — si más adelante le ponés tu
            # propio GIF o imagen en Notion, la sincronización no te la pisa.
            icono_actual = (datos.get("icon") or {}).get("emoji")
            faltantes = {}
            if icono_actual != esquema["icono"]:
                faltantes["icon"] = {"type": "emoji", "emoji": esquema["icono"]}
            if not datos.get("cover"):
                faltantes["cover"] = {"type": "external", "external": {"url": COVER_URL}}
            if faltantes:
                _patch(f"/databases/{db_id}", faltantes)
        else:
            db_id = None  # fue borrada/archivada: crear de nuevo

    if not db_id:
        propiedades = esquema["properties"]
        if callable(propiedades):
            propiedades = propiedades(conn)  # relaciones a bases creadas en runtime (Cuentas/Tarjetas/Meses)
        payload = {
            "parent": {"type": "page_id", "page_id": os.getenv("NOTION_PARENT_PAGE_ID")},
            "icon": {"type": "emoji", "emoji": esquema["icono"]},
            "cover": {"type": "external", "external": {"url": COVER_URL}},
            "title": [{"type": "text", "text": {"content": esquema["titulo"]}}],
            "properties": propiedades,
        }
        r = _post("/databases", payload)
        r.raise_for_status()
        db_id = r.json()["id"]
        db.config_set(conn, esquema["config_key"], db_id)
        # El mapa de páginas viejo ya no sirve si la base es nueva
        conn.execute("DELETE FROM notion_map WHERE tipo = ?", (clave_esquema,))
        conn.commit()

    opciones_fn = _OPCIONES_SELECT_POR_ESQUEMA.get(clave_esquema)
    if opciones_fn:
        _fusionar_opciones_select(conn, db_id, opciones_fn(conn))

    return db_id


def _asegurar_portada_pagina_padre():
    """
    Le pone ícono y portada a tu página 'Finanzas' SOLO si todavía no tiene
    (una vez que la cambiés vos —por ejemplo por tu propio GIF—, la
    sincronización nunca te la vuelve a pisar).
    """
    page_id = os.getenv("NOTION_PARENT_PAGE_ID")
    r = _get(f"/pages/{page_id}")
    if r.status_code != 200:
        return
    datos = r.json()
    faltantes = {}
    if not datos.get("cover"):
        faltantes["cover"] = {"type": "external", "external": {"url": COVER_URL}}
    if not (datos.get("icon") or {}).get("emoji"):
        faltantes["icon"] = {"type": "emoji", "emoji": "💰"}
    if faltantes:
        _patch(f"/pages/{page_id}", faltantes)


def _categorias_gasto(conn):
    return [c["nombre"] for c in conn.execute(
        "SELECT nombre FROM categorias WHERE tipo = 'gasto' AND activa = 1 ORDER BY nombre")]


def _categorias_ingreso(conn):
    return [c["nombre"] for c in conn.execute(
        "SELECT nombre FROM categorias WHERE tipo = 'ingreso' AND activa = 1 ORDER BY nombre")]


def _metodos_gasto(conn):
    return list(db.METODOS_FIJOS) + [t["nombre"] for t in conn.execute(
        "SELECT nombre FROM tarjetas WHERE activa = 1 ORDER BY nombre")]


def _fusionar_opciones_select(conn, db_id, valores_por_propiedad):
    """
    Agrega a las propiedades select indicadas (ej. {"Categoría": [...],
    "Método": [...]}) los valores que todavía no estén — SIN tocar las que ya
    existen (Notion borra el color/id de una opción si se la omite en el
    PATCH, así que siempre se fusiona con lo que ya hay en vez de reemplazar
    la lista).
    """
    r = _get(f"/databases/{db_id}")
    r.raise_for_status()
    props_actuales = r.json()["properties"]

    def opciones_actuales(nombre_prop):
        return props_actuales.get(nombre_prop, {}).get("select", {}).get("options", [])

    def fusionar(actuales, deseados):
        por_nombre = {o["name"]: o for o in actuales}
        cambio = False
        for nombre in deseados:
            if nombre not in por_nombre:
                por_nombre[nombre] = {"name": nombre, "color": COLORES_NOTION[len(por_nombre) % len(COLORES_NOTION)]}
                cambio = True
        return list(por_nombre.values()), cambio

    patch_props = {}
    for propiedad, deseados in valores_por_propiedad.items():
        opciones, cambio = fusionar(opciones_actuales(propiedad), deseados)
        if cambio:
            patch_props[propiedad] = {"select": {"options": opciones}}

    if patch_props:
        _patch(f"/databases/{db_id}", {"properties": patch_props})


def _upsert_pagina(conn, tipo, clave, db_id, propiedades, props_solo_crear=None, icono=None):
    """
    Crea o actualiza una página de Notion identificada localmente por (tipo, clave).
    props_solo_crear: propiedades que solo se fijan al crear (ej. Estado de alerta,
    para no pisar el 'Vista' que el usuario marcó desde el celular).
    icono: emoji opcional para la página (ej. semáforo 🟢🟡🔴 según % de uso).
    """
    fila = conn.execute(
        "SELECT page_id FROM notion_map WHERE tipo = ? AND clave = ?", (tipo, clave)
    ).fetchone()

    if fila:
        patch_payload = {"properties": propiedades}
        if icono:
            patch_payload["icon"] = {"type": "emoji", "emoji": icono}
        r = _patch(f"/pages/{fila['page_id']}", patch_payload)
        if r.status_code == 200:
            return
        # Si la página fue borrada en Notion, se limpia el mapa y se recrea
        conn.execute("DELETE FROM notion_map WHERE tipo = ? AND clave = ?", (tipo, clave))
        conn.commit()

    todas = dict(propiedades)
    if props_solo_crear:
        todas.update(props_solo_crear)
    create_payload = {"parent": {"database_id": db_id}, "properties": todas}
    if icono:
        create_payload["icon"] = {"type": "emoji", "emoji": icono}
    r = _post("/pages", create_payload)
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


def _meses_con_datos(conn):
    """Set de 'aaaa-mm' distintos que aparecen en gastos/ingresos/pagos_tarjetas."""
    yms = set()
    for tabla in ("gastos", "ingresos", "pagos_tarjetas"):
        for f in conn.execute(f"SELECT DISTINCT strftime('%Y-%m', fecha) ym FROM {tabla}"):
            if f["ym"]:
                yms.add(f["ym"])
    return yms


def _upsertear_mes(conn, db_meses, anio, mes):
    """
    Sube una fila del mes (anio, mes) a la base Meses. Ingresos/Gastos/Balance
    salen de datos_del_mes (ya filtran por mes); Deuda/Dinero/Patrimonio usan
    los saldos "hasta esa fecha" (db.saldo_cuentas_hasta/saldo_tarjetas_hasta)
    para que un mes viejo muestre el patrimonio de ESE momento, no el de hoy.
    """
    datos = datos_del_mes(conn, anio, mes)
    ym = f"{anio:04d}-{mes:02d}"
    dinero_total = round(db.saldo_cuentas_hasta(conn, ym), 2)
    deuda_total = round(db.saldo_tarjetas_hasta(conn, ym), 2)
    top_txt = ", ".join(f"{nombre}: {fmt_q(total)}" for nombre, total in datos["top_categorias"]) or "—"
    _upsert_pagina(conn, "meses", ym, db_meses, {
        "Mes": {"title": [{"text": {"content": f"{MESES_ES[mes]} {anio}"}}]},
        "Ingresos": {"number": datos["ingresos"]},
        "Gastos": {"number": datos["gastos"]},
        "Balance": {"number": datos["balance"]},
        "Deuda en tarjetas": {"number": deuda_total},
        "Dinero en cuentas": {"number": dinero_total},
        "Patrimonio": {"number": round(dinero_total - deuda_total, 2)},
        "Top categorías": {"rich_text": [{"text": {"content": top_txt}}]},
        "Actualizado": {"date": {"start": date.today().isoformat()}},
    }, icono="📅")


# ---------- Transacciones (Gastos/Ingresos/Pagos como páginas relacionadas) ----------

def _agregar_relacion(propiedades, nombre_prop, conn, tipo_map, clave):
    """Fija una propiedad 'relation' apuntando a la página ya mapeada (tipo_map, clave); vacía si no aplica."""
    pagina = None
    if clave:
        pagina = conn.execute(
            "SELECT page_id FROM notion_map WHERE tipo = ? AND clave = ?", (tipo_map, clave)
        ).fetchone()
    propiedades[nombre_prop] = {"relation": [{"id": pagina["page_id"]}] if pagina else []}


def _propiedades_gasto(conn, fila):
    cat = conn.execute("SELECT nombre FROM categorias WHERE id = ?", (fila["categoria_id"],)).fetchone()
    tarjeta = conn.execute("SELECT nombre FROM tarjetas WHERE id = ?", (fila["tarjeta_id"],)).fetchone() \
        if fila["tarjeta_id"] else None
    cuenta = conn.execute("SELECT nombre FROM cuentas WHERE id = ?", (fila["cuenta_id"],)).fetchone() \
        if fila["cuenta_id"] else None
    metodo_txt = tarjeta["nombre"] if tarjeta else fila["metodo"]

    props = {
        "Descripción": {"title": [{"text": {"content": fila["descripcion"] or "(sin descripción)"}}]},
        "Monto": {"number": fila["monto"]},
        "Fecha": {"date": {"start": fila["fecha"]}},
        "Categoría": {"select": {"name": cat["nombre"]}} if cat else {"select": None},
        "Método": {"select": {"name": metodo_txt}},
    }
    _agregar_relacion(props, "Cuenta", conn, "cuentas", cuenta["nombre"] if cuenta else None)
    _agregar_relacion(props, "Tarjeta", conn, "tarjetas", tarjeta["nombre"] if tarjeta else None)
    _agregar_relacion(props, "Mes", conn, "meses", fila["fecha"][:7])
    return props, "💸"


def _propiedades_ingreso(conn, fila):
    cat = conn.execute("SELECT nombre FROM categorias WHERE id = ?", (fila["categoria_id"],)).fetchone()
    cuenta = conn.execute("SELECT nombre FROM cuentas WHERE id = ?", (fila["cuenta_id"],)).fetchone() \
        if fila["cuenta_id"] else None

    props = {
        "Descripción": {"title": [{"text": {"content": fila["descripcion"] or "(sin descripción)"}}]},
        "Monto": {"number": fila["monto"]},
        "Fecha": {"date": {"start": fila["fecha"]}},
        "Categoría": {"select": {"name": cat["nombre"]}} if cat else {"select": None},
    }
    _agregar_relacion(props, "Cuenta", conn, "cuentas", cuenta["nombre"] if cuenta else None)
    _agregar_relacion(props, "Mes", conn, "meses", fila["fecha"][:7])
    return props, "💵"


def _propiedades_pago(conn, fila):
    tarjeta = conn.execute("SELECT nombre FROM tarjetas WHERE id = ?", (fila["tarjeta_id"],)).fetchone()
    cuenta = conn.execute("SELECT nombre FROM cuentas WHERE id = ?", (fila["cuenta_id"],)).fetchone() \
        if fila["cuenta_id"] else None
    nombre_tarjeta = tarjeta["nombre"] if tarjeta else "?"

    props = {
        "Descripción": {"title": [{"text": {"content": f"Pago {nombre_tarjeta}"}}]},
        "Monto": {"number": fila["monto"]},
        "Fecha": {"date": {"start": fila["fecha"]}},
    }
    _agregar_relacion(props, "Tarjeta", conn, "tarjetas", nombre_tarjeta if tarjeta else None)
    _agregar_relacion(props, "Cuenta", conn, "cuentas", cuenta["nombre"] if cuenta else None)
    _agregar_relacion(props, "Mes", conn, "meses", fila["fecha"][:7])
    return props, "🧾"


def _propiedades_pago_prestamo(conn, fila):
    prestamo = conn.execute("SELECT nombre FROM prestamos WHERE id = ?", (fila["prestamo_id"],)).fetchone()
    cuenta = conn.execute("SELECT nombre FROM cuentas WHERE id = ?", (fila["cuenta_id"],)).fetchone() \
        if fila["cuenta_id"] else None
    nombre_prestamo = prestamo["nombre"] if prestamo else "?"

    props = {
        "Descripción": {"title": [{"text": {"content": f"Pago {nombre_prestamo}"}}]},
        "Monto": {"number": fila["monto"]},
        "Fecha": {"date": {"start": fila["fecha"]}},
    }
    _agregar_relacion(props, "Préstamo", conn, "prestamos", nombre_prestamo if prestamo else None)
    _agregar_relacion(props, "Cuenta", conn, "cuentas", cuenta["nombre"] if cuenta else None)
    _agregar_relacion(props, "Mes", conn, "meses", fila["fecha"][:7])
    return props, "🧾"


def _propiedades_pago_visacuota(conn, fila):
    visacuota = conn.execute("SELECT descripcion FROM visacuotas WHERE id = ?", (fila["visacuota_id"],)).fetchone()
    cuenta = conn.execute("SELECT nombre FROM cuentas WHERE id = ?", (fila["cuenta_id"],)).fetchone() \
        if fila["cuenta_id"] else None
    nombre_visacuota = visacuota["descripcion"] if visacuota else "?"

    props = {
        "Descripción": {"title": [{"text": {"content": f"Cuota {nombre_visacuota}"}}]},
        "Monto": {"number": fila["monto"]},
        "Fecha": {"date": {"start": fila["fecha"]}},
    }
    _agregar_relacion(props, "Visa Cuotas", conn, "visacuotas", nombre_visacuota if visacuota else None)
    _agregar_relacion(props, "Cuenta", conn, "cuentas", cuenta["nombre"] if cuenta else None)
    _agregar_relacion(props, "Mes", conn, "meses", fila["fecha"][:7])
    return props, "🧾"


# tabla local -> (clave de esquema = tipo en notion_map, constructor de propiedades)
_TRANSACCIONES = [
    ("gastos", "gastos_mov", _propiedades_gasto),
    ("ingresos", "ingresos_mov", _propiedades_ingreso),
    ("pagos_tarjetas", "pagos_mov", _propiedades_pago),
    ("pagos_prestamos", "pagos_prestamos_mov", _propiedades_pago_prestamo),
    ("pagos_visacuotas", "pagos_visacuotas_mov", _propiedades_pago_visacuota),
]


def _sincronizar_transacciones(conn, tabla, tipo, db_id, construir_propiedades, ym_actual, cap_nuevas=40):
    """
    Sincroniza una tabla de transacciones como páginas individuales en Notion.
    Para no pegarle a cientos de filas en cada sync (Notion limita ~3 req/seg
    y cada edición ya dispara un sync completo en segundo plano): las filas
    YA mapeadas de un mes anterior no se vuelven a tocar; las del mes en
    curso siempre se refrescan (barato); las nuevas se crean hasta un tope
    por corrida (el resto se completa en las sync siguientes).
    """
    ids_locales = set()
    creadas = 0
    for fila in conn.execute(f"SELECT * FROM {tabla}").fetchall():
        clave = str(fila["id"])
        ids_locales.add(clave)
        ya_mapeada = conn.execute(
            "SELECT 1 FROM notion_map WHERE tipo = ? AND clave = ?", (tipo, clave)
        ).fetchone()
        if ya_mapeada and fila["fecha"][:7] != ym_actual:
            continue  # historial ya sincronizado: no se re-toca por performance
        if not ya_mapeada:
            if creadas >= cap_nuevas:
                continue  # tope por corrida: el resto se completa en syncs siguientes
            creadas += 1
        propiedades, icono = construir_propiedades(conn, fila)
        _upsert_pagina(conn, tipo, clave, db_id, propiedades, icono=icono)

    # Reconciliación de borrados: páginas mapeadas cuya fila local ya no existe
    for m in conn.execute("SELECT clave, page_id FROM notion_map WHERE tipo = ?", (tipo,)).fetchall():
        if m["clave"] not in ids_locales:
            _patch(f"/pages/{m['page_id']}", {"archived": True})
            conn.execute("DELETE FROM notion_map WHERE tipo = ? AND clave = ?", (tipo, m["clave"]))
    conn.commit()


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

    # 1b. Pagos de préstamo próximos (5 días o menos) con saldo pendiente
    for p in conn.execute("SELECT * FROM prestamos WHERE activo = 1 AND dia_pago IS NOT NULL").fetchall():
        saldo = db.saldo_prestamo(conn, p["id"])
        if saldo <= 0:
            continue
        fpago = proxima_fecha(p["dia_pago"])
        dias = (fpago - hoy).days
        if dias <= 5:
            cuando = "HOY" if dias == 0 else (f"en {dias} día" + ("s" if dias > 1 else ""))
            alertas.append({
                "clave": f"pago-prestamo-{p['nombre']}-{fpago.isoformat()}",
                "tipo": "prestamo",
                "mensaje": f"Pago de {p['nombre']} vence {cuando} (saldo {fmt_q(saldo)})",
            })

    # 1c. Pagos de Visa Cuotas próximos (5 días o menos) con cuotas restantes
    for v in conn.execute("SELECT * FROM visacuotas WHERE activo = 1 AND dia_pago IS NOT NULL").fetchall():
        saldo, cuotas_pagadas = db.saldo_visacuota(conn, v["id"])
        if cuotas_pagadas >= v["num_cuotas"]:
            continue
        fpago = proxima_fecha(v["dia_pago"])
        dias = (fpago - hoy).days
        if dias <= 5:
            cuando = "HOY" if dias == 0 else (f"en {dias} día" + ("s" if dias > 1 else ""))
            alertas.append({
                "clave": f"pago-visacuota-{v['descripcion']}-{fpago.isoformat()}",
                "tipo": "visacuota",
                "mensaje": f"Cuota de {v['descripcion']} vence {cuando} (saldo {fmt_q(saldo)})",
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


# ---------- Bandeja de gastos (Notion -> app) ----------

def importar_bandeja_notion(conn):
    """
    Lee la Bandeja de gastos en Notion (donde anotás un gasto desde el
    celular cuando no tenés la app a mano) y crea el gasto real en la base
    local. Cada fila válida se archiva en Notion al importarse (así la
    bandeja queda como una "bandeja de entrada": lo que ya se procesó,
    desaparece). Las filas con datos inválidos (categoría/método que no
    existen, monto vacío) se dejan sin archivar para que las corrijas —
    nunca se pierden ni se inventan datos.
    """
    if not esta_configurado():
        return {"importados": 0, "detalle": [], "rechazados": []}

    db_id = _asegurar_base(conn, "bandeja")
    importados, rechazados = [], []
    cursor = None

    while True:
        payload = {"page_size": 100}
        if cursor:
            payload["start_cursor"] = cursor
        r = _post(f"/databases/{db_id}/query", payload)
        r.raise_for_status()
        data = r.json()

        for pagina in data.get("results", []):
            pid = pagina["id"]
            props = pagina.get("properties", {})
            titulo_partes = props.get("Gasto", {}).get("title", [])
            titulo = "".join(t.get("plain_text", "") for t in titulo_partes) or "(sin descripción)"

            # Si ya se importó antes (la página no se pudo archivar por algún
            # corte de red), no se vuelve a crear el gasto: solo se reintenta archivar.
            ya = conn.execute(
                "SELECT 1 FROM notion_bandeja_procesados WHERE page_id = ?", (pid,)
            ).fetchone()
            if ya:
                _patch(f"/pages/{pid}", {"archived": True})
                continue

            try:
                monto = props.get("Monto", {}).get("number")
                cat_sel = props.get("Categoría", {}).get("select")
                met_sel = props.get("Método", {}).get("select")
                fecha_prop = props.get("Fecha", {}).get("date")
                fecha = fecha_prop["start"] if fecha_prop else pagina["created_time"][:10]

                if not monto or monto <= 0:
                    raise ValueError("el monto está vacío o no es válido")
                if not cat_sel:
                    raise ValueError("falta elegir la categoría")
                if not met_sel:
                    raise ValueError("falta elegir el método de pago")

                cat_id = db.resolver_categoria_gasto(conn, cat_sel["name"])
                metodo, tarjeta_id = db.resolver_metodo_gasto(conn, met_sel["name"])
                monto = round(float(monto), 2)

                cur = conn.execute(
                    "INSERT INTO gastos (fecha, descripcion, categoria_id, metodo, tarjeta_id, monto) "
                    "VALUES (?, ?, ?, ?, ?, ?)",
                    (fecha, titulo, cat_id, metodo, tarjeta_id, monto),
                )
                conn.execute(
                    "INSERT INTO notion_bandeja_procesados (page_id, gasto_id, procesado_en) "
                    "VALUES (?, ?, ?)",
                    (pid, cur.lastrowid, datetime.now().isoformat(timespec="seconds")),
                )
                conn.commit()  # durable ANTES de archivar, para no duplicar si el archivado falla
                _patch(f"/pages/{pid}", {"archived": True})
                importados.append({"descripcion": titulo, "monto": monto})
            except Exception as e:
                conn.rollback()
                rechazados.append({"descripcion": titulo, "motivo": str(e)})

        if not data.get("has_more"):
            break
        cursor = data.get("next_cursor")

    return {"importados": len(importados), "detalle": importados, "rechazados": rechazados}


# ---------- Layout: callout descriptivo antes de cada base ----------

def _organizar_layout(conn):
    """
    Inserta, una única vez, un callout a modo de encabezado justo antes de
    cada base ya creada en la página Finanzas (inspirado en plantillas
    prolijas de Notion). Se controla con la bandera 'notion_layout_v1' para
    no volver a tocar el contenido de la página en cada sincronización — si
    el usuario borra o mueve un callout después, la app no lo repone.
    """
    if db.config_get(conn, "notion_layout_v1"):
        return
    page_id = os.getenv("NOTION_PARENT_PAGE_ID")
    r = _get(f"/blocks/{page_id}/children?page_size=100")
    if r.status_code != 200:
        return
    orden_ids = [b["id"] for b in r.json().get("results", [])]

    for clave in ("cuentas", "meses", "tarjetas", "prestamos", "visacuotas", "alertas", "bandeja",
                  "gastos_mov", "ingresos_mov", "pagos_mov", "pagos_prestamos_mov", "pagos_visacuotas_mov"):
        esquema = ESQUEMAS[clave]
        if "callout" not in esquema:
            continue
        db_id = db.config_get(conn, esquema["config_key"])
        if not db_id or db_id not in orden_ids:
            continue
        idx = orden_ids.index(db_id)
        if idx == 0:
            continue  # es el primer bloque de la página: no hay dónde anclar "antes"
        titulo, texto = esquema["callout"]
        _patch(f"/blocks/{page_id}/children", {
            "after": orden_ids[idx - 1],
            "children": [{
                "object": "block", "type": "callout",
                "callout": {
                    "rich_text": [
                        {"text": {"content": titulo + "\n"}, "annotations": {"bold": True}},
                        {"text": {"content": texto}},
                    ],
                    "icon": {"type": "emoji", "emoji": esquema["icono"]},
                    "color": "gray_background",
                },
            }],
        })

    db.config_set(conn, "notion_layout_v1", "1")


# ---------- Layout: encabezado visual (menú + saldos actuales) ----------

def _rich_text_menu(conn):
    """Rich text con un link (mention) a cada base ya creada, a modo de menú."""
    partes = [{"type": "text", "text": {"content": "🧭 Menú\n"}, "annotations": {"bold": True}}]
    for clave in ("cuentas", "meses", "tarjetas", "prestamos", "visacuotas", "alertas", "bandeja",
                  "gastos_mov", "ingresos_mov", "pagos_mov", "pagos_prestamos_mov", "pagos_visacuotas_mov"):
        db_id = db.config_get(conn, ESQUEMAS[clave]["config_key"])
        if not db_id:
            continue
        partes.append({"type": "mention", "mention": {"type": "database", "database": {"id": db_id}}})
        partes.append({"type": "text", "text": {"content": "\n"}})
    return partes


def _rich_text_saldos(datos):
    """Rich text con el resumen de saldos actuales (se refresca en cada sync)."""
    partes = [{"type": "text", "text": {"content": "💰 Saldos actuales\n"}, "annotations": {"bold": True}}]
    patrimonio = round(datos["dinero_total"] - datos["deuda_total"], 2)
    for etiqueta, valor in [
        ("Ingresos del mes", datos["ingresos"]),
        ("Gastos del mes", datos["gastos"]),
        ("Balance del mes", datos["balance"]),
        ("Dinero en cuentas", datos["dinero_total"]),
        ("Deuda en tarjetas", datos["deuda_total"]),
        ("Patrimonio", patrimonio),
    ]:
        partes.append({"type": "text", "text": {"content": f"{etiqueta}: "}})
        partes.append({"type": "text", "text": {"content": f"{fmt_q(valor)}\n"}, "annotations": {"bold": True}})
    return partes


def _actualizar_dashboard_visual(conn, datos):
    """
    Crea, una única vez, un encabezado de dos columnas al estilo de las
    plantillas prolijas de Notion: "Menú" (links a cada base) + "Saldos
    actuales". El menú se arma una sola vez (bandera 'notion_layout_v2');
    el callout de saldos se actualiza en CADA sincronización porque muestra
    el mes en curso.

    Nota (limitación real de la API de Notion): no se pueden reordenar
    bloques existentes, así que este encabezado se agrega DESPUÉS del
    contenido que ya hubiera en la página — no llega automáticamente al
    principio. Si la página ya tenía bases creadas, hay que arrastrarlo
    arriba a mano en Notion una sola vez.
    """
    page_id = os.getenv("NOTION_PARENT_PAGE_ID")

    if not db.config_get(conn, "notion_layout_v2"):
        r = _patch(f"/blocks/{page_id}/children", {"children": [{
            "object": "block", "type": "column_list",
            "column_list": {"children": [
                {"object": "block", "type": "column", "column": {"children": [{
                    "object": "block", "type": "callout",
                    "callout": {"rich_text": _rich_text_menu(conn),
                                "icon": {"type": "emoji", "emoji": "🧭"},
                                "color": "gray_background"},
                }]}},
                {"object": "block", "type": "column", "column": {"children": [{
                    "object": "block", "type": "callout",
                    "callout": {"rich_text": _rich_text_saldos(datos),
                                "icon": {"type": "emoji", "emoji": "💰"},
                                "color": "blue_background"},
                }]}},
            ]},
        }]})
        if r.status_code == 200:
            column_list_id = r.json()["results"][0]["id"]
            columnas = _get(f"/blocks/{column_list_id}/children").json()["results"]
            hijos_saldos = _get(f"/blocks/{columnas[1]['id']}/children").json()["results"]
            db.config_set(conn, "notion_block_saldos", hijos_saldos[0]["id"])
        db.config_set(conn, "notion_layout_v2", "1")
        return

    callout_saldos_id = db.config_get(conn, "notion_block_saldos")
    if callout_saldos_id:
        _patch(f"/blocks/{callout_saldos_id}", {"callout": {"rich_text": _rich_text_saldos(datos)}})


# ---------- Sincronización completa ----------

def sincronizar(conn):
    """
    Sube todo a Notion. Lanza excepción si algo falla (el que llama decide
    si la ignora); si termina bien, limpia la bandera de sync pendiente.
    """
    if not esta_configurado():
        raise RuntimeError("Notion no está configurado (revisá el archivo .env)")

    _asegurar_portada_pagina_padre()

    # Se lee PRIMERO la Bandeja de gastos (Notion -> app): si anotaste algo
    # desde el celular, ya queda reflejado en el Resumen/Alertas que se suben
    # en esta misma pasada.
    resultado_bandeja = importar_bandeja_notion(conn)

    hoy = date.today()
    datos = datos_del_mes(conn)

    # --- 1a. Cuentas (upsert por nombre, mismo patrón que Tarjetas) ---
    db_cuentas = _asegurar_base(conn, "cuentas")
    for c in conn.execute("SELECT * FROM cuentas WHERE activa = 1").fetchall():
        saldo = db.saldo_cuenta(conn, c["id"])
        _upsert_pagina(conn, "cuentas", c["nombre"], db_cuentas, {
            "Cuenta": {"title": [{"text": {"content": c["nombre"]}}]},
            "Banco": {"rich_text": [{"text": {"content": c["banco"]}}]},
            "Tipo": {"select": {"name": c["tipo"]}},
            "Saldo": {"number": saldo},
        }, icono="💰")

    # --- 1b. Meses: una fila POR MES con datos (se acumula, nunca se pisa) para
    #          poder armar una vista de Gráfica (Chart) con el historial en
    #          Notion, y para que los Gastos/Ingresos históricos tengan a qué
    #          "Mes" relacionarse ---
    db_meses = _asegurar_base(conn, "meses")
    ym_actual = f"{datos['anio']:04d}-{datos['mes']:02d}"
    yms = _meses_con_datos(conn)
    yms.add(ym_actual)
    for ym in sorted(yms):
        _upsertear_mes(conn, db_meses, int(ym[:4]), int(ym[5:7]))

    # --- 2. Tarjetas (upsert por nombre; ícono semáforo según % de uso) ---
    db_tarjetas = _asegurar_base(conn, "tarjetas")
    for t in conn.execute("SELECT * FROM tarjetas WHERE activa = 1").fetchall():
        saldo = db.saldo_tarjeta(conn, t["id"])
        disponible = round(t["limite"] - saldo, 2)
        pct = round(saldo / t["limite"] * 100, 1) if t["limite"] else 0
        icono = "🟢" if pct < 30 else "🟡" if pct <= 70 else "🔴"
        _upsert_pagina(conn, "tarjetas", t["nombre"], db_tarjetas, {
            "Tarjeta": {"title": [{"text": {"content": t["nombre"]}}]},
            "Banco": {"rich_text": [{"text": {"content": t["banco"]}}]},
            "Saldo": {"number": saldo},
            "Disponible": {"number": disponible},
            "% Uso": {"number": round(pct / 100, 4)},  # Notion "percent" espera fracción 0–1
            "Próximo corte": {"date": {"start": proxima_fecha(t["dia_corte"]).isoformat()}},
            "Próximo pago": {"date": {"start": proxima_fecha(t["dia_pago"]).isoformat()}},
        }, icono=icono)

    # --- 2b. Préstamos (upsert por nombre; ícono según % pagado) ---
    db_prestamos = _asegurar_base(conn, "prestamos")
    for p in conn.execute("SELECT * FROM prestamos WHERE activo = 1").fetchall():
        saldo = db.saldo_prestamo(conn, p["id"])
        pct = round((p["saldo_inicial"] - saldo) / p["saldo_inicial"] * 100, 1) if p["saldo_inicial"] else 100.0
        icono = "🟢" if pct >= 70 else "🟡" if pct >= 30 else "🔴"
        _upsert_pagina(conn, "prestamos", p["nombre"], db_prestamos, {
            "Préstamo": {"title": [{"text": {"content": p["nombre"]}}]},
            "Institución": {"rich_text": [{"text": {"content": p["institucion"]}}]},
            "Saldo pendiente": {"number": saldo},
            "Cuota mensual": {"number": p["cuota_mensual"]},
            "% Pagado": {"number": round(pct / 100, 4)},
            "Próximo pago": {"date": {"start": proxima_fecha(p["dia_pago"]).isoformat()} if p["dia_pago"] else None},
        }, icono=icono)

    # --- 2c. Visa Cuotas (upsert por descripción; ícono ✅ si ya se completó) ---
    db_visacuotas = _asegurar_base(conn, "visacuotas")
    for v in conn.execute("SELECT * FROM visacuotas WHERE activo = 1").fetchall():
        saldo, cuotas_pagadas = db.saldo_visacuota(conn, v["id"])
        completa = cuotas_pagadas >= v["num_cuotas"]
        props = {
            "Visa Cuotas": {"title": [{"text": {"content": v["descripcion"]}}]},
            "Saldo pendiente": {"number": saldo},
            "Cuota mensual": {"number": v["cuota_mensual"]},
            "Cuotas": {"rich_text": [{"text": {"content": f"{cuotas_pagadas} de {v['num_cuotas']}"}}]},
            "Próximo pago": {"date": {"start": proxima_fecha(v["dia_pago"]).isoformat()} if (v["dia_pago"] and not completa) else None},
        }
        tarjeta = conn.execute("SELECT nombre FROM tarjetas WHERE id = ?", (v["tarjeta_id"],)).fetchone()
        _agregar_relacion(props, "Tarjeta", conn, "tarjetas", tarjeta["nombre"] if tarjeta else None)
        _upsert_pagina(conn, "visacuotas", v["descripcion"], db_visacuotas, props, icono="✅" if completa else "🛒")

    # --- 2d. Gastos/Ingresos/Pagos de tarjetas/préstamos/cuotas: una página por
    #         transacción, relacionada con su Cuenta/Tarjeta/Préstamo/Cuota/Mes
    #         (esas bases ya están mapeadas arriba, así que las relaciones
    #         resuelven bien) ---
    for tabla, clave_esquema, construir in _TRANSACCIONES:
        db_mov = _asegurar_base(conn, clave_esquema)
        _sincronizar_transacciones(conn, tabla, clave_esquema, db_mov, construir, ym_actual)

    # --- 3. Alertas (upsert por clave; el Estado solo se fija al crear,
    #        así lo que marqués como "Vista" desde el celular se respeta) ---
    db_alertas = _asegurar_base(conn, "alertas")
    for a in generar_alertas(conn):
        _upsert_pagina(
            conn, "alertas", a["clave"], db_alertas,
            {
                "Alerta": {"title": [{"text": {"content": a["mensaje"]}}]},
                "Fecha": {"date": {"start": hoy.isoformat()}},
                "Tipo": {"select": {"name": a["tipo"]}},
            },
            props_solo_crear={"Estado": {"select": {"name": "Pendiente"}}},
            icono=ICONOS_ALERTA.get(a["tipo"], "🔔"),
        )

    # Layout visual: cosmético, nunca debe tumbar la sincronización de datos
    try:
        _actualizar_dashboard_visual(conn, datos)
        _organizar_layout(conn)
    except Exception:
        pass

    # Todo salió bien: limpiar bandera y registrar la hora
    db.config_set(conn, "sync_pendiente", "0")
    db.config_set(conn, "ultima_sync", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    return {"ok": True, "resumen": datos, "alertas": len(generar_alertas(conn)),
            "bandeja": resultado_bandeja}
