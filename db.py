"""
db.py — Conexión y esquema de la base de datos SQLite (finanzas.db).

La base es un archivo local junto a app.py; para respaldar basta copiar el archivo.
"""

import os
import sqlite3

# Ruta del archivo de base de datos, siempre junto a este script
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "finanzas.db")

# Categorías precargadas la primera vez que se crea la base
CATEGORIAS_GASTO = [
    "Alimentación", "Vivienda", "Transporte", "Servicios", "Salud",
    "Educación", "Entretenimiento", "Ropa", "Ahorro/Inversión", "Deudas", "Otros",
]
CATEGORIAS_INGRESO = ["Salario", "Negocio", "Freelance", "Intereses", "Remesas", "Otros"]

# Métodos de pago fijos (además de las tarjetas del usuario)
METODOS_FIJOS = ["Efectivo", "Débito", "Transferencia"]


def get_conn():
    """Devuelve una conexión nueva a la base, con filas accesibles por nombre."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    """Crea las tablas si no existen y precarga las categorías iniciales."""
    conn = get_conn()
    cur = conn.cursor()

    cur.executescript("""
    -- Categorías de ingreso y gasto (se pueden desactivar, no borrar)
    CREATE TABLE IF NOT EXISTS categorias (
        id      INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre  TEXT NOT NULL,
        tipo    TEXT NOT NULL CHECK (tipo IN ('ingreso', 'gasto')),
        activa  INTEGER NOT NULL DEFAULT 1,
        UNIQUE (nombre, tipo)
    );

    -- Tarjetas de crédito del usuario.
    -- saldo_inicial: deuda que la tarjeta ya traía al registrarla (opcional, puede ser 0)
    CREATE TABLE IF NOT EXISTS tarjetas (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        banco         TEXT NOT NULL,
        nombre        TEXT NOT NULL UNIQUE,
        limite        REAL NOT NULL CHECK (limite > 0),
        dia_corte     INTEGER NOT NULL CHECK (dia_corte BETWEEN 1 AND 31),
        dia_pago      INTEGER NOT NULL CHECK (dia_pago BETWEEN 1 AND 31),
        saldo_inicial REAL NOT NULL DEFAULT 0,
        activa        INTEGER NOT NULL DEFAULT 1
    );

    -- Cuentas de dinero del usuario (Monetaria / Ahorro) por banco.
    -- saldo_inicial: cuánto había en la cuenta al registrarla.
    CREATE TABLE IF NOT EXISTS cuentas (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        banco         TEXT NOT NULL,
        nombre        TEXT NOT NULL UNIQUE,
        tipo          TEXT NOT NULL CHECK (tipo IN ('Monetaria', 'Ahorro')),
        saldo_inicial REAL NOT NULL DEFAULT 0,
        activa        INTEGER NOT NULL DEFAULT 1
    );

    -- Ingresos (recurrente_id enlaza con el ingreso recurrente que lo generó;
    -- cuenta_id: a qué cuenta entró el dinero, opcional)
    CREATE TABLE IF NOT EXISTS ingresos (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha         TEXT NOT NULL,               -- formato ISO aaaa-mm-dd
        descripcion   TEXT NOT NULL DEFAULT '',
        categoria_id  INTEGER NOT NULL REFERENCES categorias(id),
        monto         REAL NOT NULL CHECK (monto > 0),
        recurrente_id INTEGER REFERENCES ingresos_recurrentes(id),
        cuenta_id     INTEGER REFERENCES cuentas(id)
    );

    -- Gastos. Si metodo = 'Tarjeta', tarjeta_id indica cuál (y suma al saldo de esa tarjeta).
    -- Si metodo = 'Débito' o 'Transferencia', cuenta_id indica de qué cuenta salió (opcional).
    CREATE TABLE IF NOT EXISTS gastos (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha        TEXT NOT NULL,
        descripcion  TEXT NOT NULL DEFAULT '',
        categoria_id INTEGER NOT NULL REFERENCES categorias(id),
        metodo       TEXT NOT NULL CHECK (metodo IN ('Efectivo', 'Débito', 'Transferencia', 'Tarjeta')),
        tarjeta_id   INTEGER REFERENCES tarjetas(id),
        cuenta_id    INTEGER REFERENCES cuentas(id),
        monto        REAL NOT NULL CHECK (monto > 0)
    );

    -- Pagos hechos a tarjetas (reducen el saldo de la tarjeta;
    -- cuenta_id: de qué cuenta salió el pago, opcional)
    CREATE TABLE IF NOT EXISTS pagos_tarjetas (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha      TEXT NOT NULL,
        tarjeta_id INTEGER NOT NULL REFERENCES tarjetas(id),
        cuenta_id  INTEGER REFERENCES cuentas(id),
        monto      REAL NOT NULL CHECK (monto > 0)
    );

    -- Ingresos recurrentes (ej. salario).
    -- frecuencia 'Mensual': se recibe una vez, el día dia_mes.
    -- frecuencia 'Quincenal': se recibe dos veces, los días dia_mes y dia_mes_2
    -- (el monto es POR quincena, no el total del mes).
    CREATE TABLE IF NOT EXISTS ingresos_recurrentes (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        descripcion  TEXT NOT NULL,
        categoria_id INTEGER NOT NULL REFERENCES categorias(id),
        monto        REAL NOT NULL CHECK (monto > 0),
        dia_mes      INTEGER NOT NULL CHECK (dia_mes BETWEEN 1 AND 31),
        frecuencia   TEXT NOT NULL DEFAULT 'Mensual' CHECK (frecuencia IN ('Mensual', 'Quincenal')),
        dia_mes_2    INTEGER CHECK (dia_mes_2 BETWEEN 1 AND 31),
        activo       INTEGER NOT NULL DEFAULT 1
    );

    -- Confirmaciones de ingresos recurrentes por mes (y por quincena si aplica).
    -- Se registran aparte de la tabla ingresos: si borrás el ingreso generado,
    -- la app NO te vuelve a pedir confirmarlo ese mes.
    CREATE TABLE IF NOT EXISTS recurrentes_confirmaciones (
        recurrente_id INTEGER NOT NULL REFERENCES ingresos_recurrentes(id),
        anio_mes      TEXT NOT NULL,               -- 'aaaa-mm'
        quincena      INTEGER NOT NULL DEFAULT 1,  -- 1 = dia_mes, 2 = dia_mes_2
        PRIMARY KEY (recurrente_id, anio_mes, quincena)
    );

    -- Pagos frecuentes (gastos recurrentes): renta, internet, colegio, streaming...
    -- Mismo mecanismo que los ingresos recurrentes: la app pide confirmar cada
    -- mes (o quincena) y genera el gasto con el método de pago preconfigurado.
    CREATE TABLE IF NOT EXISTS gastos_recurrentes (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        descripcion  TEXT NOT NULL,
        categoria_id INTEGER NOT NULL REFERENCES categorias(id),
        monto        REAL NOT NULL CHECK (monto > 0),
        dia_mes      INTEGER NOT NULL CHECK (dia_mes BETWEEN 1 AND 31),
        frecuencia   TEXT NOT NULL DEFAULT 'Mensual' CHECK (frecuencia IN ('Mensual', 'Quincenal')),
        dia_mes_2    INTEGER CHECK (dia_mes_2 BETWEEN 1 AND 31),
        metodo       TEXT NOT NULL DEFAULT 'Efectivo'
                     CHECK (metodo IN ('Efectivo', 'Débito', 'Transferencia', 'Tarjeta')),
        tarjeta_id   INTEGER REFERENCES tarjetas(id),
        cuenta_id    INTEGER REFERENCES cuentas(id),
        activo       INTEGER NOT NULL DEFAULT 1
    );

    -- Confirmaciones de pagos frecuentes (mismo esquema que las de ingresos)
    CREATE TABLE IF NOT EXISTS gastos_rec_confirmaciones (
        recurrente_id INTEGER NOT NULL REFERENCES gastos_recurrentes(id),
        anio_mes      TEXT NOT NULL,
        quincena      INTEGER NOT NULL DEFAULT 1,
        PRIMARY KEY (recurrente_id, anio_mes, quincena)
    );

    -- Configuración interna clave/valor (IDs de bases de Notion, bandera de sync pendiente, etc.)
    CREATE TABLE IF NOT EXISTS config (
        clave TEXT PRIMARY KEY,
        valor TEXT
    );

    -- Mapa de filas locales -> páginas de Notion, para actualizar sin duplicar
    CREATE TABLE IF NOT EXISTS notion_map (
        tipo    TEXT NOT NULL,   -- 'resumen' | 'tarjeta' | 'alerta'
        clave   TEXT NOT NULL,   -- identificador local (ej. nombre de tarjeta)
        page_id TEXT NOT NULL,
        PRIMARY KEY (tipo, clave)
    );

    -- Páginas de la "Bandeja de gastos" (Notion -> app) ya importadas como gasto.
    -- Evita duplicar un gasto si la sincronización se corta justo después de
    -- crearlo pero antes de poder archivar la página en Notion.
    CREATE TABLE IF NOT EXISTS notion_bandeja_procesados (
        page_id      TEXT PRIMARY KEY,
        gasto_id     INTEGER REFERENCES gastos(id),
        procesado_en TEXT NOT NULL
    );
    """)

    # Migraciones: agregar columnas nuevas a bases creadas con versiones anteriores
    _asegurar_columna(cur, "tarjetas", "saldo_inicial", "saldo_inicial REAL NOT NULL DEFAULT 0")
    _asegurar_columna(cur, "ingresos", "cuenta_id", "cuenta_id INTEGER REFERENCES cuentas(id)")
    _asegurar_columna(cur, "gastos", "cuenta_id", "cuenta_id INTEGER REFERENCES cuentas(id)")
    _asegurar_columna(cur, "pagos_tarjetas", "cuenta_id", "cuenta_id INTEGER REFERENCES cuentas(id)")
    _asegurar_columna(cur, "ingresos_recurrentes", "frecuencia",
                      "frecuencia TEXT NOT NULL DEFAULT 'Mensual'")
    _asegurar_columna(cur, "ingresos_recurrentes", "dia_mes_2", "dia_mes_2 INTEGER")

    # Migración: registrar como confirmados los ingresos recurrentes ya generados
    cur.execute("""
        INSERT OR IGNORE INTO recurrentes_confirmaciones (recurrente_id, anio_mes)
        SELECT recurrente_id, strftime('%Y-%m', fecha) FROM ingresos
        WHERE recurrente_id IS NOT NULL
    """)

    # Precargar categorías (INSERT OR IGNORE: no duplica si ya existen)
    for nombre in CATEGORIAS_GASTO:
        cur.execute("INSERT OR IGNORE INTO categorias (nombre, tipo) VALUES (?, 'gasto')", (nombre,))
    for nombre in CATEGORIAS_INGRESO:
        cur.execute("INSERT OR IGNORE INTO categorias (nombre, tipo) VALUES (?, 'ingreso')", (nombre,))

    conn.commit()
    conn.close()


def _asegurar_columna(cur, tabla, columna, ddl):
    """Agrega una columna si no existe (migración simple y segura)."""
    columnas = [c[1] for c in cur.execute(f"PRAGMA table_info({tabla})").fetchall()]
    if columna not in columnas:
        cur.execute(f"ALTER TABLE {tabla} ADD COLUMN {ddl}")


# ---------- Helpers de configuración ----------

def config_get(conn, clave, defecto=None):
    """Lee un valor de la tabla config."""
    fila = conn.execute("SELECT valor FROM config WHERE clave = ?", (clave,)).fetchone()
    return fila["valor"] if fila else defecto


def config_set(conn, clave, valor):
    """Guarda un valor en la tabla config (upsert)."""
    conn.execute(
        "INSERT INTO config (clave, valor) VALUES (?, ?) "
        "ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor",
        (clave, valor),
    )
    conn.commit()


def saldo_tarjeta(conn, tarjeta_id):
    """Saldo de una tarjeta = deuda inicial + gastos con ella − pagos a ella."""
    inicial = conn.execute(
        "SELECT saldo_inicial FROM tarjetas WHERE id = ?", (tarjeta_id,)
    ).fetchone()["saldo_inicial"]
    gastos = conn.execute(
        "SELECT COALESCE(SUM(monto), 0) AS t FROM gastos WHERE tarjeta_id = ?", (tarjeta_id,)
    ).fetchone()["t"]
    pagos = conn.execute(
        "SELECT COALESCE(SUM(monto), 0) AS t FROM pagos_tarjetas WHERE tarjeta_id = ?", (tarjeta_id,)
    ).fetchone()["t"]
    return round(inicial + gastos - pagos, 2)


def resolver_categoria_gasto(conn, nombre):
    """
    Resuelve un nombre de categoría de GASTO activa a su id (sin importar
    mayúsculas/minúsculas). Lanza ValueError si no existe o está desactivada.
    Compartido entre el import de CSV y el import de la Bandeja de Notion.
    """
    nombre = (nombre or "").strip()
    fila = conn.execute(
        "SELECT id FROM categorias WHERE lower(nombre) = lower(?) AND tipo = 'gasto' AND activa = 1",
        (nombre,),
    ).fetchone()
    if not fila:
        raise ValueError(f"categoría de gasto desconocida: '{nombre}'")
    return fila["id"]


def resolver_metodo_gasto(conn, texto):
    """
    Resuelve un texto de método de pago a (metodo, tarjeta_id). Acepta
    'Efectivo'/'Débito'/'Transferencia' (sin tilde tolerado) o el nombre de
    una tarjeta activa. Lanza ValueError si no coincide con nada.
    """
    texto = (texto or "").strip()
    low = texto.lower()
    fijos = {m.lower(): m for m in METODOS_FIJOS}
    fijos["debito"] = "Débito"  # tolerar sin tilde
    if low in fijos:
        return fijos[low], None
    fila = conn.execute(
        "SELECT id FROM tarjetas WHERE lower(nombre) = ? AND activa = 1", (low,)
    ).fetchone()
    if fila:
        return "Tarjeta", fila["id"]
    raise ValueError(f"método/tarjeta desconocido: '{texto}'")


def saldo_cuenta(conn, cuenta_id):
    """
    Saldo de una cuenta = saldo inicial + ingresos que entraron a ella
    − gastos que salieron de ella − pagos de tarjeta hechos desde ella.
    """
    inicial = conn.execute(
        "SELECT saldo_inicial FROM cuentas WHERE id = ?", (cuenta_id,)
    ).fetchone()["saldo_inicial"]
    entradas = conn.execute(
        "SELECT COALESCE(SUM(monto), 0) AS t FROM ingresos WHERE cuenta_id = ?", (cuenta_id,)
    ).fetchone()["t"]
    salidas = conn.execute(
        "SELECT COALESCE(SUM(monto), 0) AS t FROM gastos WHERE cuenta_id = ?", (cuenta_id,)
    ).fetchone()["t"]
    pagos = conn.execute(
        "SELECT COALESCE(SUM(monto), 0) AS t FROM pagos_tarjetas WHERE cuenta_id = ?", (cuenta_id,)
    ).fetchone()["t"]
    return round(inicial + entradas - salidas - pagos, 2)
