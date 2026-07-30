"""
Helpers compartidos por todos los routers.

Acá vive lo que no pertenece a ningún recurso en particular: los validadores
que traducen entrada mala a HTTPException, el disparo de la sincronización con
Notion, y `hoy()`.
"""
import calendar
import threading
from datetime import date, datetime

from fastapi import HTTPException

import db
import notion_sync

METODOS_VALIDOS = ("Efectivo", "D\u00e9bito", "Transferencia", "Tarjeta")
MESES_ES = ["", "enero", "febrero", "marzo", "abril", "mayo", "junio",
            "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]


def hoy():
    """
    La fecha de hoy, en UNA sola funci\u00f3n.

    Existe para que el tiempo tenga una costura \u00fanica. Antes cada endpoint
    llamaba a `date.today()` por su cuenta y los tests parcheaban `app.date`;
    al partir app.py en routers eso dejaba de funcionar, porque cada m\u00f3dulo
    tiene su propio `date`. Con esto, un test que necesita pararse en diciembre
    parchea `api.comun.hoy` y vale para toda la app.
    """
    return date.today()

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


def validar_prestamo(conn, prestamo_id):
    fila = conn.execute("SELECT * FROM prestamos WHERE id = ?", (prestamo_id,)).fetchone()
    if not fila:
        raise HTTPException(400, "Préstamo inexistente")
    return fila


def validar_visacuota(conn, visacuota_id):
    fila = conn.execute("SELECT * FROM visacuotas WHERE id = ?", (visacuota_id,)).fetchone()
    if not fila:
        raise HTTPException(400, "Visa Cuotas inexistente")
    return fila


def clamp_dia(anio, mes, dia):
    """Ajusta un día al máximo del mes (día 31 en junio → 30)."""
    return date(anio, mes, min(dia, calendar.monthrange(anio, mes)[1]))


# ---------- Modelos de entrada (Pydantic) ----------


def _borrar(tabla, reg_id, pre_sql=None):
    """Borra un registro de la tabla indicada (uso interno, tabla controlada).

    pre_sql: sentencias (sql, params) a ejecutar antes del DELETE, p. ej. para
    desvincular filas que referencian este registro y no violar una FK.
    """
    conn = db.get_conn()
    try:
        for sql, params in (pre_sql or []):
            conn.execute(sql, params)
        cur = conn.execute(f"DELETE FROM {tabla} WHERE id = ?", (reg_id,))
        if cur.rowcount == 0:
            raise HTTPException(404, "Registro no encontrado")
        conn.commit()
        marcar_y_sincronizar(conn)
        return {"ok": True}
    finally:
        conn.close()
