"""
app.py — Finanzas personales en quetzales (Q). App local con FastAPI + SQLite.

Para levantarla:  python app.py   →  http://localhost:8000

La sincronización con Notion nunca bloquea el registro de datos: se intenta
en segundo plano y, si falla, queda pendiente para el próximo intento.
"""

import calendar
import csv
import io
import os
import threading
import zipfile
from datetime import date, datetime
from typing import Optional

import uvicorn
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import db
import notion_sync

app = FastAPI(title="Finanzas Personales")

# Crear la base y precargar categorías al arrancar (idempotente)
db.init_db()

METODOS_VALIDOS = ("Efectivo", "Débito", "Transferencia", "Tarjeta")
MESES_ES = ["", "enero", "febrero", "marzo", "abril", "mayo", "junio",
            "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]

# ---------- Sincronización con Notion en segundo plano ----------

_sync_lock = threading.Lock()


def _sync_en_hilo():
    """Corre la sincronización sin bloquear; los errores solo se registran."""
    if not _sync_lock.acquire(blocking=False):
        return  # ya hay una sincronización corriendo; la bandera pendiente cubre el reintento
    try:
        conn = db.get_conn()
        try:
            notion_sync.sincronizar(conn)
        except Exception as e:
            print(f"[notion] Sincronización falló (se reintentará): {e}")
        finally:
            conn.close()
    finally:
        _sync_lock.release()


def marcar_y_sincronizar(conn):
    """Marca que hay cambios pendientes y dispara un intento de sync en segundo plano."""
    db.config_set(conn, "sync_pendiente", "1")
    if notion_sync.esta_configurado():
        threading.Thread(target=_sync_en_hilo, daemon=True).start()


# ---------- Helpers de validación ----------

def validar_fecha(texto):
    """Acepta aaaa-mm-dd (ISO) o dd/mm/aaaa; devuelve siempre ISO."""
    for formato in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(texto.strip(), formato).date().isoformat()
        except (ValueError, AttributeError):
            continue
    raise HTTPException(400, f"Fecha inválida: '{texto}' (usá dd/mm/aaaa)")


def validar_monto(monto):
    try:
        monto = round(float(monto), 2)
    except (TypeError, ValueError):
        raise HTTPException(400, "El monto debe ser un número")
    if monto <= 0:
        raise HTTPException(400, "El monto debe ser mayor a 0")
    return monto


def validar_categoria(conn, categoria_id, tipo):
    fila = conn.execute("SELECT * FROM categorias WHERE id = ?", (categoria_id,)).fetchone()
    if not fila:
        raise HTTPException(400, "Categoría inexistente")
    if fila["tipo"] != tipo:
        raise HTTPException(400, f"La categoría '{fila['nombre']}' no es de tipo {tipo}")
    return fila


def validar_tarjeta(conn, tarjeta_id):
    fila = conn.execute("SELECT * FROM tarjetas WHERE id = ?", (tarjeta_id,)).fetchone()
    if not fila:
        raise HTTPException(400, "Tarjeta inexistente")
    return fila


def validar_cuenta(conn, cuenta_id):
    fila = conn.execute("SELECT * FROM cuentas WHERE id = ?", (cuenta_id,)).fetchone()
    if not fila:
        raise HTTPException(400, "Cuenta inexistente")
    return fila


def clamp_dia(anio, mes, dia):
    """Ajusta un día al máximo del mes (día 31 en junio → 30)."""
    return date(anio, mes, min(dia, calendar.monthrange(anio, mes)[1]))


# ---------- Modelos de entrada (Pydantic) ----------

class CategoriaIn(BaseModel):
    nombre: str
    tipo: str  # 'ingreso' | 'gasto'

class CategoriaEdit(BaseModel):
    nombre: Optional[str] = None
    activa: Optional[bool] = None

class TarjetaIn(BaseModel):
    banco: str
    nombre: str
    limite: float
    dia_corte: int
    dia_pago: int
    saldo_inicial: float = 0  # deuda que ya traía la tarjeta (opcional, puede ser 0)
    activa: bool = True

class CuentaIn(BaseModel):
    banco: str
    nombre: str
    tipo: str                 # 'Monetaria' | 'Ahorro'
    saldo_inicial: float = 0  # dinero que había al registrarla (opcional)
    activa: bool = True

class IngresoIn(BaseModel):
    fecha: str
    descripcion: str = ""
    categoria_id: int
    monto: float
    cuenta_id: Optional[int] = None  # a qué cuenta entró (opcional)

class GastoIn(BaseModel):
    fecha: str
    descripcion: str = ""
    categoria_id: int
    metodo: str
    tarjeta_id: Optional[int] = None
    cuenta_id: Optional[int] = None  # de qué cuenta salió (Débito/Transferencia, opcional)
    monto: float

class PagoIn(BaseModel):
    fecha: str
    tarjeta_id: int
    cuenta_id: Optional[int] = None  # desde qué cuenta se pagó (opcional)
    monto: float

class RecurrenteIn(BaseModel):
    descripcion: str
    categoria_id: int
    monto: float               # si es Quincenal, es el monto POR quincena
    dia_mes: int
    frecuencia: str = "Mensual"      # 'Mensual' | 'Quincenal'
    dia_mes_2: Optional[int] = None  # segundo día del mes (solo Quincenal)
    activo: bool = True

class ConfirmarIn(BaseModel):
    monto: float
    quincena: int = 1  # 1 = primer día, 2 = segundo día (solo Quincenal)

class GastoRecurrenteIn(BaseModel):
    descripcion: str
    categoria_id: int
    monto: float               # si es Quincenal, es el monto POR quincena
    dia_mes: int
    frecuencia: str = "Mensual"
    dia_mes_2: Optional[int] = None
    metodo: str = "Efectivo"
    tarjeta_id: Optional[int] = None
    cuenta_id: Optional[int] = None
    activo: bool = True


# ============================================================
# CATEGORÍAS
# ============================================================

@app.get("/api/categorias")
def listar_categorias(tipo: Optional[str] = None, incluir_inactivas: bool = False):
    conn = db.get_conn()
    try:
        sql, params = "SELECT * FROM categorias WHERE 1=1", []
        if tipo:
            sql += " AND tipo = ?"; params.append(tipo)
        if not incluir_inactivas:
            sql += " AND activa = 1"
        sql += " ORDER BY nombre"
        return [dict(f) for f in conn.execute(sql, params).fetchall()]
    finally:
        conn.close()


@app.post("/api/categorias")
def crear_categoria(body: CategoriaIn):
    if body.tipo not in ("ingreso", "gasto"):
        raise HTTPException(400, "El tipo debe ser 'ingreso' o 'gasto'")
    nombre = body.nombre.strip()
    if not nombre:
        raise HTTPException(400, "El nombre no puede estar vacío")
    conn = db.get_conn()
    try:
        existe = conn.execute(
            "SELECT 1 FROM categorias WHERE nombre = ? AND tipo = ?", (nombre, body.tipo)
        ).fetchone()
        if existe:
            raise HTTPException(400, f"Ya existe la categoría '{nombre}' de tipo {body.tipo}")
        cur = conn.execute(
            "INSERT INTO categorias (nombre, tipo) VALUES (?, ?)", (nombre, body.tipo)
        )
        conn.commit()
        return {"id": cur.lastrowid, "nombre": nombre, "tipo": body.tipo, "activa": 1}
    finally:
        conn.close()


@app.put("/api/categorias/{cat_id}")
def editar_categoria(cat_id: int, body: CategoriaEdit):
    conn = db.get_conn()
    try:
        fila = conn.execute("SELECT * FROM categorias WHERE id = ?", (cat_id,)).fetchone()
        if not fila:
            raise HTTPException(404, "Categoría no encontrada")
        nombre = body.nombre.strip() if body.nombre is not None else fila["nombre"]
        activa = int(body.activa) if body.activa is not None else fila["activa"]
        if not nombre:
            raise HTTPException(400, "El nombre no puede estar vacío")
        conn.execute("UPDATE categorias SET nombre = ?, activa = ? WHERE id = ?",
                     (nombre, activa, cat_id))
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


# ============================================================
# TARJETAS
# ============================================================

def _tarjeta_con_saldo(conn, t):
    """Arma el dict de una tarjeta con saldo, disponible, % de uso y días a corte/pago."""
    saldo = db.saldo_tarjeta(conn, t["id"])
    hoy = date.today()
    return {
        **dict(t),
        "saldo": saldo,
        "disponible": round(t["limite"] - saldo, 2),
        "pct_uso": round(saldo / t["limite"] * 100, 1) if t["limite"] else 0,
        "proximo_corte": notion_sync.proxima_fecha(t["dia_corte"]).isoformat(),
        "proximo_pago": notion_sync.proxima_fecha(t["dia_pago"]).isoformat(),
        "dias_corte": (notion_sync.proxima_fecha(t["dia_corte"]) - hoy).days,
        "dias_pago": (notion_sync.proxima_fecha(t["dia_pago"]) - hoy).days,
    }


@app.get("/api/tarjetas")
def listar_tarjetas(incluir_inactivas: bool = False):
    conn = db.get_conn()
    try:
        sql = "SELECT * FROM tarjetas" + ("" if incluir_inactivas else " WHERE activa = 1")
        return [_tarjeta_con_saldo(conn, t)
                for t in conn.execute(sql + " ORDER BY nombre").fetchall()]
    finally:
        conn.close()


@app.post("/api/tarjetas")
def crear_tarjeta(body: TarjetaIn):
    _validar_tarjeta_in(body)
    conn = db.get_conn()
    try:
        existe = conn.execute("SELECT 1 FROM tarjetas WHERE nombre = ?",
                              (body.nombre.strip(),)).fetchone()
        if existe:
            raise HTTPException(400, f"Ya existe una tarjeta llamada '{body.nombre.strip()}'")
        cur = conn.execute(
            "INSERT INTO tarjetas (banco, nombre, limite, dia_corte, dia_pago, saldo_inicial, activa) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (body.banco.strip(), body.nombre.strip(), validar_monto(body.limite),
             body.dia_corte, body.dia_pago, body.saldo_inicial, int(body.activa)),
        )
        conn.commit()
        marcar_y_sincronizar(conn)
        return {"id": cur.lastrowid}
    finally:
        conn.close()


@app.put("/api/tarjetas/{tarjeta_id}")
def editar_tarjeta(tarjeta_id: int, body: TarjetaIn):
    _validar_tarjeta_in(body)
    conn = db.get_conn()
    try:
        validar_tarjeta(conn, tarjeta_id)
        duplicada = conn.execute("SELECT 1 FROM tarjetas WHERE nombre = ? AND id != ?",
                                 (body.nombre.strip(), tarjeta_id)).fetchone()
        if duplicada:
            raise HTTPException(400, f"Ya existe otra tarjeta llamada '{body.nombre.strip()}'")
        conn.execute(
            "UPDATE tarjetas SET banco=?, nombre=?, limite=?, dia_corte=?, dia_pago=?, "
            "saldo_inicial=?, activa=? WHERE id = ?",
            (body.banco.strip(), body.nombre.strip(), validar_monto(body.limite),
             body.dia_corte, body.dia_pago, body.saldo_inicial, int(body.activa), tarjeta_id),
        )
        conn.commit()
        marcar_y_sincronizar(conn)
        return {"ok": True}
    finally:
        conn.close()


def _validar_tarjeta_in(body: TarjetaIn):
    if not body.nombre.strip() or not body.banco.strip():
        raise HTTPException(400, "Banco y nombre son obligatorios")
    if not (1 <= body.dia_corte <= 31) or not (1 <= body.dia_pago <= 31):
        raise HTTPException(400, "Los días de corte y pago deben estar entre 1 y 31")
    if body.saldo_inicial < 0:
        raise HTTPException(400, "El saldo inicial no puede ser negativo")


# ============================================================
# CUENTAS (Monetaria / Ahorro)
# ============================================================

@app.get("/api/cuentas")
def listar_cuentas(incluir_inactivas: bool = False):
    conn = db.get_conn()
    try:
        sql = "SELECT * FROM cuentas" + ("" if incluir_inactivas else " WHERE activa = 1")
        return [{**dict(c), "saldo": db.saldo_cuenta(conn, c["id"])}
                for c in conn.execute(sql + " ORDER BY banco, nombre").fetchall()]
    finally:
        conn.close()


@app.post("/api/cuentas")
def crear_cuenta(body: CuentaIn):
    _validar_cuenta_in(body)
    conn = db.get_conn()
    try:
        existe = conn.execute("SELECT 1 FROM cuentas WHERE nombre = ?",
                              (body.nombre.strip(),)).fetchone()
        if existe:
            raise HTTPException(400, f"Ya existe una cuenta llamada '{body.nombre.strip()}'")
        cur = conn.execute(
            "INSERT INTO cuentas (banco, nombre, tipo, saldo_inicial, activa) VALUES (?, ?, ?, ?, ?)",
            (body.banco.strip(), body.nombre.strip(), body.tipo,
             body.saldo_inicial, int(body.activa)),
        )
        conn.commit()
        marcar_y_sincronizar(conn)
        return {"id": cur.lastrowid}
    finally:
        conn.close()


@app.put("/api/cuentas/{cuenta_id}")
def editar_cuenta(cuenta_id: int, body: CuentaIn):
    _validar_cuenta_in(body)
    conn = db.get_conn()
    try:
        validar_cuenta(conn, cuenta_id)
        duplicada = conn.execute("SELECT 1 FROM cuentas WHERE nombre = ? AND id != ?",
                                 (body.nombre.strip(), cuenta_id)).fetchone()
        if duplicada:
            raise HTTPException(400, f"Ya existe otra cuenta llamada '{body.nombre.strip()}'")
        conn.execute(
            "UPDATE cuentas SET banco=?, nombre=?, tipo=?, saldo_inicial=?, activa=? WHERE id = ?",
            (body.banco.strip(), body.nombre.strip(), body.tipo,
             body.saldo_inicial, int(body.activa), cuenta_id),
        )
        conn.commit()
        marcar_y_sincronizar(conn)
        return {"ok": True}
    finally:
        conn.close()


def _validar_cuenta_in(body: CuentaIn):
    if not body.nombre.strip() or not body.banco.strip():
        raise HTTPException(400, "Banco y nombre son obligatorios")
    if body.tipo not in ("Monetaria", "Ahorro"):
        raise HTTPException(400, "El tipo debe ser 'Monetaria' o 'Ahorro'")


@app.get("/api/metodos_pago")
def metodos_pago():
    """Métodos fijos + tarjetas activas, para armar los botones del formulario."""
    conn = db.get_conn()
    try:
        metodos = [{"metodo": m, "tarjeta_id": None, "etiqueta": m} for m in db.METODOS_FIJOS]
        for t in conn.execute("SELECT id, nombre FROM tarjetas WHERE activa = 1 ORDER BY nombre"):
            metodos.append({"metodo": "Tarjeta", "tarjeta_id": t["id"], "etiqueta": t["nombre"]})
        return metodos
    finally:
        conn.close()


# ============================================================
# INGRESOS / GASTOS / PAGOS DE TARJETA
# ============================================================

@app.post("/api/ingresos")
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


@app.put("/api/ingresos/{reg_id}")
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


@app.delete("/api/ingresos/{reg_id}")
def borrar_ingreso(reg_id: int):
    return _borrar("ingresos", reg_id)


@app.post("/api/gastos")
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


@app.put("/api/gastos/{reg_id}")
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


@app.delete("/api/gastos/{reg_id}")
def borrar_gasto(reg_id: int):
    return _borrar("gastos", reg_id)


@app.post("/api/pagos_tarjetas")
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


@app.put("/api/pagos_tarjetas/{reg_id}")
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


@app.delete("/api/pagos_tarjetas/{reg_id}")
def borrar_pago(reg_id: int):
    return _borrar("pagos_tarjetas", reg_id)


def _borrar(tabla, reg_id):
    """Borra un registro de la tabla indicada (uso interno, tabla controlada)."""
    conn = db.get_conn()
    try:
        cur = conn.execute(f"DELETE FROM {tabla} WHERE id = ?", (reg_id,))
        if cur.rowcount == 0:
            raise HTTPException(404, "Registro no encontrado")
        conn.commit()
        marcar_y_sincronizar(conn)
        return {"ok": True}
    finally:
        conn.close()


# ============================================================
# MOVIMIENTOS (lista combinada con filtros)
# ============================================================

@app.get("/api/movimientos")
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

        movs.sort(key=lambda m: (m["fecha"], m["id"]), reverse=True)
        return movs
    finally:
        conn.close()


# ============================================================
# DASHBOARD
# ============================================================

@app.get("/api/dashboard")
def dashboard(anio: Optional[int] = None, mes: Optional[int] = None):
    hoy = date.today()
    anio, mes = anio or hoy.year, mes or hoy.month
    ym = f"{anio:04d}-{mes:02d}"
    conn = db.get_conn()
    try:
        datos = notion_sync.datos_del_mes(conn, anio, mes)
        pagos_mes = datos["pagos_tarjetas"]

        # Métrica clave del asalariado: qué queda del salario del mes
        disponible_salario = round(datos["ingresos"] - datos["gastos"] - pagos_mes, 2)

        # Días hasta el próximo ingreso recurrente (el día de cobro más cercano,
        # contando ambos días de los quincenales)
        dias_salario = None
        for rec in conn.execute(
            "SELECT dia_mes, frecuencia, dia_mes_2 FROM ingresos_recurrentes WHERE activo = 1"
        ).fetchall():
            dias = [rec["dia_mes"]]
            if rec["frecuencia"] == "Quincenal" and rec["dia_mes_2"]:
                dias.append(rec["dia_mes_2"])
            for dia in dias:
                d_falta = (notion_sync.proxima_fecha(dia) - hoy).days
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
        for f in conn.execute(
            """SELECT c.nombre, SUM(g.monto) t FROM gastos g
               JOIN categorias c ON c.id = g.categoria_id
               WHERE strftime('%Y-%m', g.fecha) = ? GROUP BY c.nombre ORDER BY t DESC""", (ym,)
        ):
            pastel["labels"].append(f["nombre"])
            pastel["datos"].append(round(f["t"], 2))

        tarjetas = [_tarjeta_con_saldo(conn, t)
                    for t in conn.execute("SELECT * FROM tarjetas WHERE activa = 1 ORDER BY nombre")]

        # Cuentas de dinero: cuánto tenés en total y por cuenta
        cuentas = [{**dict(c), "saldo": db.saldo_cuenta(conn, c["id"])}
                   for c in conn.execute("SELECT * FROM cuentas WHERE activa = 1 ORDER BY banco, nombre")]
        dinero_total = round(sum(c["saldo"] for c in cuentas), 2)

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

        return {
            "anio": anio, "mes": mes,
            "ingresos": datos["ingresos"], "gastos": datos["gastos"],
            "balance": datos["balance"], "deuda_total": datos["deuda_total"],
            "pagos_tarjetas_mes": pagos_mes,
            "disponible_salario": disponible_salario,
            "dias_proximo_salario": dias_salario,
            "dinero_total": dinero_total, "cuentas": cuentas,
            # Salud financiera: patrimonio = dinero en cuentas − deuda en tarjetas,
            # y bandera de si la deuda rebasa los ingresos del mes
            "patrimonio": round(dinero_total - datos["deuda_total"], 2),
            "deuda_supera_ingresos": datos["deuda_total"] > datos["ingresos"] > 0,
            "analisis": {"top_categorias": top_categorias, "top_gastos": top_gastos,
                         "gastos_mes_anterior": round(sum(gasto_ant_por_cat.values()), 2)},
            "barras": barras, "pastel": pastel, "tarjetas": tarjetas,
        }
    finally:
        conn.close()


# ============================================================
# INGRESOS RECURRENTES (salario)
# ============================================================

@app.get("/api/recurrentes")
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
    if body.frecuencia not in ("Mensual", "Quincenal"):
        raise HTTPException(400, "La frecuencia debe ser 'Mensual' o 'Quincenal'")
    if body.frecuencia == "Quincenal":
        if not body.dia_mes_2 or not (1 <= body.dia_mes_2 <= 31):
            raise HTTPException(400, "Para frecuencia quincenal indicá el segundo día (1-31)")
        if body.dia_mes_2 == body.dia_mes:
            raise HTTPException(400, "Los dos días de la quincena deben ser distintos")


@app.post("/api/recurrentes")
def crear_recurrente(body: RecurrenteIn):
    _validar_recurrente_in(body)
    conn = db.get_conn()
    try:
        validar_categoria(conn, body.categoria_id, "ingreso")
        cur = conn.execute(
            "INSERT INTO ingresos_recurrentes "
            "(descripcion, categoria_id, monto, dia_mes, frecuencia, dia_mes_2, activo) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (body.descripcion.strip(), body.categoria_id, validar_monto(body.monto),
             body.dia_mes, body.frecuencia,
             body.dia_mes_2 if body.frecuencia == "Quincenal" else None, int(body.activo)),
        )
        conn.commit()
        return {"id": cur.lastrowid}
    finally:
        conn.close()


@app.put("/api/recurrentes/{rec_id}")
def editar_recurrente(rec_id: int, body: RecurrenteIn):
    _validar_recurrente_in(body)
    conn = db.get_conn()
    try:
        if not conn.execute("SELECT 1 FROM ingresos_recurrentes WHERE id = ?", (rec_id,)).fetchone():
            raise HTTPException(404, "Ingreso recurrente no encontrado")
        validar_categoria(conn, body.categoria_id, "ingreso")
        conn.execute(
            "UPDATE ingresos_recurrentes SET descripcion=?, categoria_id=?, monto=?, dia_mes=?, "
            "frecuencia=?, dia_mes_2=?, activo=? WHERE id = ?",
            (body.descripcion.strip(), body.categoria_id, validar_monto(body.monto),
             body.dia_mes, body.frecuencia,
             body.dia_mes_2 if body.frecuencia == "Quincenal" else None,
             int(body.activo), rec_id),
        )
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@app.delete("/api/recurrentes/{rec_id}")
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


@app.get("/api/recurrentes/pendientes")
def recurrentes_pendientes():
    """
    Ingresos recurrentes cuyo día ya pasó este mes y que aún no fueron
    confirmados NI omitidos. La confirmación se registra aparte de la tabla
    de ingresos: borrar el ingreso generado no vuelve a activar el aviso.
    """
    hoy = date.today()
    ym = hoy.strftime("%Y-%m")
    conn = db.get_conn()
    try:
        pendientes = []
        for r in conn.execute(
            """SELECT r.*, c.nombre AS categoria FROM ingresos_recurrentes r
               JOIN categorias c ON c.id = r.categoria_id WHERE r.activo = 1"""
        ).fetchall():
            # Ocurrencias del mes: una (Mensual) o dos (Quincenal)
            ocurrencias = [(1, r["dia_mes"])]
            if r["frecuencia"] == "Quincenal" and r["dia_mes_2"]:
                ocurrencias.append((2, r["dia_mes_2"]))
            for quincena, dia in ocurrencias:
                fecha_este_mes = clamp_dia(hoy.year, hoy.month, dia)
                if fecha_este_mes > hoy:
                    continue  # todavía no toca este mes
                ya = conn.execute(
                    "SELECT 1 FROM recurrentes_confirmaciones "
                    "WHERE recurrente_id = ? AND anio_mes = ? AND quincena = ?",
                    (r["id"], ym, quincena),
                ).fetchone()
                if not ya:
                    etiqueta = r["descripcion"] + (
                        f" (quincena {quincena})" if r["frecuencia"] == "Quincenal" else "")
                    pendientes.append({**dict(r), "quincena": quincena, "etiqueta": etiqueta,
                                       "fecha_sugerida": fecha_este_mes.isoformat(),
                                       "mes_nombre": MESES_ES[hoy.month]})
        return pendientes
    finally:
        conn.close()


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


@app.post("/api/recurrentes/{rec_id}/confirmar")
def confirmar_recurrente(rec_id: int, body: ConfirmarIn):
    """Confirma el ingreso recurrente del mes/quincena (con el monto ajustado si varió)."""
    hoy = date.today()
    conn = db.get_conn()
    try:
        r = conn.execute("SELECT * FROM ingresos_recurrentes WHERE id = ?", (rec_id,)).fetchone()
        if not r:
            raise HTTPException(404, "Ingreso recurrente no encontrado")
        quincena = 2 if (body.quincena == 2 and r["frecuencia"] == "Quincenal") else 1
        _marcar_confirmado(conn, rec_id, hoy.strftime("%Y-%m"), quincena)
        dia = r["dia_mes_2"] if quincena == 2 else r["dia_mes"]
        fecha = clamp_dia(hoy.year, hoy.month, dia)
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


@app.post("/api/recurrentes/{rec_id}/omitir")
def omitir_recurrente(rec_id: int, quincena: int = 1):
    """Omite el ingreso recurrente este mes/quincena: no crea ingreso y el aviso desaparece."""
    hoy = date.today()
    conn = db.get_conn()
    try:
        r = conn.execute("SELECT * FROM ingresos_recurrentes WHERE id = ?", (rec_id,)).fetchone()
        if not r:
            raise HTTPException(404, "Ingreso recurrente no encontrado")
        q = 2 if (quincena == 2 and r["frecuencia"] == "Quincenal") else 1
        _marcar_confirmado(conn, rec_id, hoy.strftime("%Y-%m"), q)
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


# ============================================================
# PAGOS FRECUENTES (gastos recurrentes)
# ============================================================

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


@app.get("/api/gastos_recurrentes")
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


@app.post("/api/gastos_recurrentes")
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


@app.put("/api/gastos_recurrentes/{rec_id}")
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


@app.delete("/api/gastos_recurrentes/{rec_id}")
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


@app.get("/api/gastos_recurrentes/pendientes")
def gastos_recurrentes_pendientes():
    """Pagos frecuentes cuyo día ya pasó este mes y aún no fueron confirmados ni omitidos."""
    hoy = date.today()
    ym = hoy.strftime("%Y-%m")
    conn = db.get_conn()
    try:
        pendientes = []
        for r in conn.execute(
            """SELECT g.*, c.nombre AS categoria, t.nombre AS tarjeta, cu.nombre AS cuenta
               FROM gastos_recurrentes g JOIN categorias c ON c.id = g.categoria_id
               LEFT JOIN tarjetas t ON t.id = g.tarjeta_id
               LEFT JOIN cuentas cu ON cu.id = g.cuenta_id WHERE g.activo = 1"""
        ).fetchall():
            ocurrencias = [(1, r["dia_mes"])]
            if r["frecuencia"] == "Quincenal" and r["dia_mes_2"]:
                ocurrencias.append((2, r["dia_mes_2"]))
            for quincena, dia in ocurrencias:
                fecha_este_mes = clamp_dia(hoy.year, hoy.month, dia)
                if fecha_este_mes > hoy:
                    continue
                ya = conn.execute(
                    "SELECT 1 FROM gastos_rec_confirmaciones "
                    "WHERE recurrente_id = ? AND anio_mes = ? AND quincena = ?",
                    (r["id"], ym, quincena),
                ).fetchone()
                if not ya:
                    etiqueta = r["descripcion"] + (
                        f" (quincena {quincena})" if r["frecuencia"] == "Quincenal" else "")
                    pendientes.append({**dict(r), "quincena": quincena, "etiqueta": etiqueta,
                                       "fecha_sugerida": fecha_este_mes.isoformat(),
                                       "mes_nombre": MESES_ES[hoy.month]})
        return pendientes
    finally:
        conn.close()


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


@app.post("/api/gastos_recurrentes/{rec_id}/confirmar")
def confirmar_gasto_recurrente(rec_id: int, body: ConfirmarIn):
    """Confirma el pago frecuente y crea el gasto con su método preconfigurado."""
    hoy = date.today()
    conn = db.get_conn()
    try:
        r = conn.execute("SELECT * FROM gastos_recurrentes WHERE id = ?", (rec_id,)).fetchone()
        if not r:
            raise HTTPException(404, "Pago frecuente no encontrado")
        quincena = 2 if (body.quincena == 2 and r["frecuencia"] == "Quincenal") else 1
        _marcar_gasto_confirmado(conn, rec_id, hoy.strftime("%Y-%m"), quincena)
        dia = r["dia_mes_2"] if quincena == 2 else r["dia_mes"]
        fecha = clamp_dia(hoy.year, hoy.month, dia)
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


@app.post("/api/gastos_recurrentes/{rec_id}/omitir")
def omitir_gasto_recurrente(rec_id: int, quincena: int = 1):
    """Omite el pago frecuente este mes/quincena sin crear el gasto."""
    hoy = date.today()
    conn = db.get_conn()
    try:
        r = conn.execute("SELECT * FROM gastos_recurrentes WHERE id = ?", (rec_id,)).fetchone()
        if not r:
            raise HTTPException(404, "Pago frecuente no encontrado")
        q = 2 if (quincena == 2 and r["frecuencia"] == "Quincenal") else 1
        _marcar_gasto_confirmado(conn, rec_id, hoy.strftime("%Y-%m"), q)
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


# ============================================================
# NOTION
# ============================================================

@app.post("/api/notion/sync")
def sync_notion_manual():
    """Botón "Sincronizar con Notion": corre la sincronización y espera el resultado."""
    if not notion_sync.esta_configurado():
        raise HTTPException(400, "Notion no está configurado. Copiá .env.example como .env "
                                 "y llená NOTION_TOKEN y NOTION_PARENT_PAGE_ID (ver README).")
    conn = db.get_conn()
    try:
        db.config_set(conn, "sync_pendiente", "1")
        resultado = notion_sync.sincronizar(conn)
        return {"ok": True, "alertas": resultado["alertas"],
                "ultima_sync": db.config_get(conn, "ultima_sync")}
    except Exception as e:
        raise HTTPException(502, f"Notion no respondió: {e}. Tus datos locales están bien; "
                                 "quedó pendiente para reintentar.")
    finally:
        conn.close()


@app.get("/api/notion/estado")
def notion_estado():
    conn = db.get_conn()
    try:
        return {
            "configurado": notion_sync.esta_configurado(),
            "sync_pendiente": db.config_get(conn, "sync_pendiente") == "1",
            "ultima_sync": db.config_get(conn, "ultima_sync"),
        }
    finally:
        conn.close()


# ============================================================
# EXPORTAR / IMPORTAR CSV
# ============================================================

def _query_export(conn, tabla):
    """Filas de exportación por tabla, con nombres legibles en vez de IDs."""
    consultas = {
        "categorias": ("nombre,tipo,activa",
                       "SELECT nombre, tipo, activa FROM categorias ORDER BY tipo, nombre"),
        "tarjetas": ("banco,nombre,limite,dia_corte,dia_pago,saldo_inicial,activa",
                     "SELECT banco, nombre, limite, dia_corte, dia_pago, saldo_inicial, activa FROM tarjetas"),
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
        "ingresos_recurrentes": ("descripcion,categoria,monto,dia_mes,frecuencia,dia_mes_2,activo",
                                 """SELECT r.descripcion, c.nombre, r.monto, r.dia_mes,
                                           r.frecuencia, r.dia_mes_2, r.activo
                                    FROM ingresos_recurrentes r
                                    JOIN categorias c ON c.id = r.categoria_id"""),
        "gastos_recurrentes": ("descripcion,categoria,monto,dia_mes,frecuencia,dia_mes_2,metodo,cuenta,activo",
                               """SELECT g.descripcion, c.nombre, g.monto, g.dia_mes,
                                         g.frecuencia, g.dia_mes_2,
                                         CASE WHEN g.metodo = 'Tarjeta' THEN t.nombre ELSE g.metodo END,
                                         cu.nombre, g.activo
                                  FROM gastos_recurrentes g
                                  JOIN categorias c ON c.id = g.categoria_id
                                  LEFT JOIN tarjetas t ON t.id = g.tarjeta_id
                                  LEFT JOIN cuentas cu ON cu.id = g.cuenta_id"""),
    }
    encabezado, sql = consultas[tabla]
    return encabezado.split(","), conn.execute(sql).fetchall()


@app.get("/api/export")
def exportar_todo():
    """Descarga un ZIP con un CSV por tabla (mismo formato que acepta la importación)."""
    conn = db.get_conn()
    try:
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            for tabla in ("categorias", "tarjetas", "cuentas", "ingresos", "gastos",
                          "pagos_tarjetas", "ingresos_recurrentes", "gastos_recurrentes"):
                encabezado, filas = _query_export(conn, tabla)
                salida = io.StringIO()
                w = csv.writer(salida, lineterminator="\n")
                w.writerow(encabezado)
                for f in filas:
                    w.writerow(list(f))
                zf.writestr(f"{tabla}.csv", salida.getvalue())
        buffer.seek(0)
        nombre = f"finanzas_export_{date.today().isoformat()}.zip"
        return StreamingResponse(buffer, media_type="application/zip",
                                 headers={"Content-Disposition": f"attachment; filename={nombre}"})
    finally:
        conn.close()


@app.post("/api/import/{tabla}")
async def importar_csv(tabla: str, archivo: UploadFile = File(...)):
    """
    Importa un CSV con el mismo formato que la exportación. Valida fila por fila
    y devuelve un resumen: cuántas entraron y cuáles se rechazaron (con motivo).
    """
    if tabla not in ("categorias", "tarjetas", "cuentas", "ingresos", "gastos",
                     "pagos_tarjetas", "ingresos_recurrentes", "gastos_recurrentes"):
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
                    conn.execute(
                        "INSERT INTO tarjetas (banco, nombre, limite, dia_corte, dia_pago, saldo_inicial, activa) "
                        "VALUES (?, ?, ?, ?, ?, ?, ?)",
                        (fila["banco"], fila["nombre"], validar_monto(fila["limite"]),
                         int(fila["dia_corte"]), int(fila["dia_pago"]),
                         float(fila.get("saldo_inicial", "0") or 0),
                         int(fila.get("activa", "1") or 1)))
                    tars = {t["nombre"].lower(): t["id"] for t in conn.execute("SELECT * FROM tarjetas")}

                elif tabla == "ingresos_recurrentes":
                    cat_id = cats.get((fila["categoria"].lower(), "ingreso"))
                    if not cat_id:
                        raise ValueError(f"categoría de ingreso desconocida: '{fila['categoria']}'")
                    frec = fila.get("frecuencia", "") or "Mensual"
                    if frec not in ("Mensual", "Quincenal"):
                        raise ValueError(f"frecuencia inválida: '{frec}' (Mensual o Quincenal)")
                    dia2 = int(fila["dia_mes_2"]) if (frec == "Quincenal" and fila.get("dia_mes_2")) else None
                    if frec == "Quincenal" and not dia2:
                        raise ValueError("frecuencia Quincenal requiere la columna dia_mes_2")
                    conn.execute(
                        "INSERT INTO ingresos_recurrentes "
                        "(descripcion, categoria_id, monto, dia_mes, frecuencia, dia_mes_2, activo) "
                        "VALUES (?, ?, ?, ?, ?, ?, ?)",
                        (fila["descripcion"], cat_id, validar_monto(fila["monto"]),
                         int(fila["dia_mes"]), frec, dia2, int(fila.get("activo", "1") or 1)))

                elif tabla == "gastos_recurrentes":
                    cat_id = cats.get((fila["categoria"].lower(), "gasto"))
                    if not cat_id:
                        raise ValueError(f"categoría de gasto desconocida: '{fila['categoria']}'")
                    frec = fila.get("frecuencia", "") or "Mensual"
                    if frec not in ("Mensual", "Quincenal"):
                        raise ValueError(f"frecuencia inválida: '{frec}' (Mensual o Quincenal)")
                    dia2 = int(fila["dia_mes_2"]) if (frec == "Quincenal" and fila.get("dia_mes_2")) else None
                    if frec == "Quincenal" and not dia2:
                        raise ValueError("frecuencia Quincenal requiere la columna dia_mes_2")
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
                        " metodo, tarjeta_id, cuenta_id, activo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        (fila["descripcion"], cat_id, validar_monto(fila["monto"]),
                         int(fila["dia_mes"]), frec, dia2, met, tid, cuenta_de(fila),
                         int(fila.get("activo", "1") or 1)))

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


# ============================================================
# FRONTEND
# ============================================================

STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
def raiz():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))


# ---------- Arranque ----------

if __name__ == "__main__":
    print("Finanzas Personales — http://localhost:8000")
    # SOLO localhost: nadie más en la red (wifi del trabajo, etc.) puede ver tus datos.
    # Para consultar desde el celular se usa la sincronización con Notion.
    uvicorn.run(app, host="127.0.0.1", port=8000)
