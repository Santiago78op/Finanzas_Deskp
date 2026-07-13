"""
notion_sync.py — Sincronización con Notion.

Sube a Notion (app -> Notion):
  1. "Resumen del mes": ingresos, gastos, balance, deuda en tarjetas y top 5
     categorías de gasto. Se actualizan las mismas filas (no se acumulan).
  2. "Tarjetas": una fila por tarjeta (upsert por nombre).
  3. "Alertas": avisos generados por la app, con fecha, tipo y estado.

Baja de Notion (Notion -> app), único canal de entrada:
  4. "Bandeja de gastos": la anotás desde el celular cuando no tenés la app
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

# Íconos por concepto del Resumen del mes (el resto usa 🏷️, ver más abajo)
ICONOS_RESUMEN = {
    "Mes": "📅",
    "Ingresos del mes": "📈",
    "Gastos del mes": "📉",
    "Balance del mes": "⚖️",
    "Deuda total en tarjetas": "💳",
    "Dinero en cuentas": "🏦",
    "Patrimonio (cuentas − deuda)": "💎",
}
ICONOS_ALERTA = {"tarjeta": "💳", "balance": "⚠️", "ritmo": "🏃"}


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
        "icono": "📊",
        "properties": {
            "Concepto": {"title": {}},
            "Valor": {"rich_text": {}},
            "Actualizado": {"date": {}},
        },
    },
    "tarjetas": {
        "titulo": "Tarjetas",
        "config_key": "notion_db_tarjetas",
        "icono": "💳",
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
    "alertas": {
        "titulo": "Alertas",
        "config_key": "notion_db_alertas",
        "icono": "🔔",
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
    "bandeja": {
        "titulo": "Bandeja de gastos",
        "config_key": "notion_db_bandeja",
        "icono": "📥",
        "properties": {
            "Gasto": {"title": {}},
            "Monto": {"number": {"format": "number_with_commas"}},
            "Categoría": {"select": {"options": []}},
            "Método": {"select": {"options": []}},
            "Fecha": {"date": {}},
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
            if clave_esquema == "bandeja":
                _refrescar_opciones_bandeja(conn, db_id)
            return db_id
        db_id = None  # fue borrada/archivada: crear de nuevo

    payload = {
        "parent": {"type": "page_id", "page_id": os.getenv("NOTION_PARENT_PAGE_ID")},
        "icon": {"type": "emoji", "emoji": esquema["icono"]},
        "cover": {"type": "external", "external": {"url": COVER_URL}},
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
    if clave_esquema == "bandeja":
        _refrescar_opciones_bandeja(conn, db_id)
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


def _refrescar_opciones_bandeja(conn, db_id):
    """
    Agrega a los selects Categoría/Método de la Bandeja las categorías y
    tarjetas activas que todavía no estén — SIN tocar las que ya existen
    (Notion borra el color/id de una opción si se la omite en el PATCH, así
    que siempre se fusiona con lo que ya hay en vez de reemplazar la lista).
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

    cats = [c["nombre"] for c in conn.execute(
        "SELECT nombre FROM categorias WHERE tipo = 'gasto' AND activa = 1 ORDER BY nombre")]
    metodos = list(db.METODOS_FIJOS) + [t["nombre"] for t in conn.execute(
        "SELECT nombre FROM tarjetas WHERE activa = 1 ORDER BY nombre")]

    opciones_cat, cambio_cat = fusionar(opciones_actuales("Categoría"), cats)
    opciones_met, cambio_met = fusionar(opciones_actuales("Método"), metodos)

    if cambio_cat or cambio_met:
        _patch(f"/databases/{db_id}", {"properties": {
            "Categoría": {"select": {"options": opciones_cat}},
            "Método": {"select": {"options": opciones_met}},
        }})


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
        icono = ICONOS_RESUMEN.get(concepto, "🏷️")
        _upsert_pagina(conn, "resumen", concepto, db_resumen, {
            "Concepto": {"title": [{"text": {"content": concepto}}]},
            "Valor": {"rich_text": [{"text": {"content": valor}}]},
            "Actualizado": {"date": {"start": hoy.isoformat()}},
        }, icono=icono)

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
            icono=ICONOS_ALERTA.get(a["tipo"], "🔔"),
        )

    # Todo salió bien: limpiar bandera y registrar la hora
    db.config_set(conn, "sync_pendiente", "0")
    db.config_set(conn, "ultima_sync", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    return {"ok": True, "resumen": datos, "alertas": len(generar_alertas(conn)),
            "bandeja": resultado_bandeja}
