"""
Configuración compartida de la suite.

DOS COSAS PASAN ANTES QUE CUALQUIER TEST, y las dos son de seguridad:

1. Se apunta DEDUN_DB a una base temporal ANTES de importar `app`. No es un
   detalle de estilo: `app.py` llama a `db.init_db()` en el momento de
   importarse (app.py:31), así que si la variable no está puesta para
   entonces, el solo hecho de correr pytest abre y migra tu finanzas.db real.

2. Se desactiva la sincronización con Notion. Casi todos los endpoints
   terminan en `marcar_y_sincronizar()`, que levanta un hilo contra la API de
   Notion si hay token en el .env — y el .env del repo lo tiene. Sin esto, la
   suite le escribiría a tu Notion de verdad.
"""
import os
import tempfile
from pathlib import Path

# --- (1) Base temporal, ANTES de importar app/db ---------------------------
_DIR_TMP = Path(tempfile.mkdtemp(prefix="dedun-tests-"))
os.environ["DEDUN_DB"] = str(_DIR_TMP / "arranque.db")

from datetime import date  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import db  # noqa: E402
import app as app_modulo  # noqa: E402
import notion_sync  # noqa: E402
from api import comun  # noqa: E402


@pytest.fixture(autouse=True)
def _sin_notion(monkeypatch):
    """(2) Ningún test habla con Notion, tenga o no .env configurado."""
    monkeypatch.setattr(notion_sync, "esta_configurado", lambda: False)


@pytest.fixture
def base(tmp_path, monkeypatch):
    """
    Base vacía y recién migrada, propia de cada test.

    Se parchea `db.DB_PATH` en vez de la variable de entorno porque
    `get_conn()` lee el global en cada llamada: así cada test queda aislado
    aunque otro haya escrito antes.
    """
    ruta = tmp_path / "finanzas.db"
    monkeypatch.setattr(db, "DB_PATH", str(ruta))
    db.init_db()
    conn = db.get_conn()
    yield conn
    conn.close()


@pytest.fixture
def cliente(base):
    """TestClient de FastAPI apuntando a la base del test (por `base`)."""
    return TestClient(app_modulo.app)


@pytest.fixture
def en_fecha(monkeypatch):
    """
    Para la app en una fecha fija: `en_fecha(2026, 12, 16)`.

    Parchea `api.comun.hoy`, que es la ÚNICA función de la app que consulta el
    reloj. Antes cada endpoint llamaba a `date.today()` por su cuenta y esto
    tenía que parchear `app.date` con una subclase de `date` que redefinía
    today(); al partir app.py en routers eso dejó de funcionar, porque cada
    módulo pasó a tener su propio `date`. Con una sola costura, un test que
    necesita pararse en diciembre parchea un solo nombre y vale para toda la
    app — dashboard, ahorros y recurrentes incluidos.
    """
    def _en(anio, mes, dia):
        monkeypatch.setattr(comun, "hoy", lambda: date(anio, mes, dia))
    return _en


# --- Helpers de datos ------------------------------------------------------
# Los tests de plata necesitan filas de partida. Se insertan con SQL directo
# y no por la API a propósito: lo que se está probando es el cálculo de
# saldos, no el camino HTTP, y así un fallo señala una sola cosa.

def crear_tarjeta(conn, nombre="Visa X", saldo_inicial=0, activa=1, limite=10000, marca=None):
    cur = conn.execute(
        "INSERT INTO tarjetas (banco, nombre, limite, dia_corte, dia_pago, "
        "saldo_inicial, activa, marca) VALUES ('BX', ?, ?, 5, 20, ?, ?, ?)",
        (nombre, limite, saldo_inicial, activa, marca),
    )
    conn.commit()
    return cur.lastrowid


def crear_cuenta(conn, nombre="Monetaria X", saldo_inicial=0, activa=1):
    cur = conn.execute(
        "INSERT INTO cuentas (banco, nombre, tipo, saldo_inicial, activa) "
        "VALUES ('BX', ?, 'Monetaria', ?, ?)",
        (nombre, saldo_inicial, activa),
    )
    conn.commit()
    return cur.lastrowid


def id_categoria(conn, nombre, tipo):
    return conn.execute(
        "SELECT id FROM categorias WHERE nombre = ? AND tipo = ?", (nombre, tipo)
    ).fetchone()["id"]


def crear_gasto(conn, monto, fecha="2026-07-15", tarjeta_id=None, cuenta_id=None,
                categoria="Otros"):
    metodo = "Tarjeta" if tarjeta_id else "Efectivo"
    conn.execute(
        "INSERT INTO gastos (fecha, descripcion, categoria_id, metodo, tarjeta_id, "
        "cuenta_id, monto) VALUES (?, 'test', ?, ?, ?, ?, ?)",
        (fecha, id_categoria(conn, categoria, "gasto"), metodo, tarjeta_id, cuenta_id, monto),
    )
    conn.commit()


def crear_ingreso(conn, monto, fecha="2026-07-01", cuenta_id=None, categoria="Salario"):
    conn.execute(
        "INSERT INTO ingresos (fecha, descripcion, categoria_id, cuenta_id, monto) "
        "VALUES (?, 'test', ?, ?, ?)",
        (fecha, id_categoria(conn, categoria, "ingreso"), cuenta_id, monto),
    )
    conn.commit()


def crear_pago_tarjeta(conn, tarjeta_id, monto, fecha="2026-07-20", cuenta_id=None):
    # pagos_tarjetas no lleva descripción (a diferencia de gastos/ingresos):
    # un pago a la tarjeta no necesita concepto.
    conn.execute(
        "INSERT INTO pagos_tarjetas (fecha, tarjeta_id, cuenta_id, monto) VALUES (?, ?, ?, ?)",
        (fecha, tarjeta_id, cuenta_id, monto),
    )
    conn.commit()
