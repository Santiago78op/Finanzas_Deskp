"""
db.py — Conexión y esquema de la base de datos SQLite (finanzas.db).

La base es un archivo local junto a app.py; para respaldar basta copiar el archivo.
"""

import os
import sqlite3

# Ruta del archivo de base de datos: por defecto junto a este script.
#
# DEDUN_DB permite apuntar a otro archivo. Existe para que los tests corran
# contra una base temporal: sin esto, `pytest` abriría la finanzas.db real y
# le escribiría encima — o sea, la suite de pruebas te borraría los datos.
# En uso normal no se define y todo queda igual que antes.
DB_PATH = os.environ.get(
    "DEDUN_DB",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "finanzas.db"),
)

# Categorías precargadas la primera vez que se crea la base
CATEGORIAS_GASTO = [
    "Alimentación", "Vivienda", "Transporte", "Servicios", "Salud",
    "Educación", "Entretenimiento", "Ropa", "Ahorro/Inversión", "Deudas", "Otros",
]
# Bono 14 y Aguinaldo van como categorías propias y no dentro de "Salario":
# son las dos prestaciones anuales obligatorias en Guatemala (Decretos 42-92 y
# 76-78) y meterlas en Salario distorsiona el análisis — julio y diciembre
# aparecerían como meses de ingreso el doble de alto sin explicación visible.
CATEGORIAS_INGRESO = ["Salario", "Bono 14", "Aguinaldo", "Negocio", "Freelance",
                      "Intereses", "Remesas", "Otros"]

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

    _migrar_visacuotas_tarjeta_obligatoria(cur)
    _migrar_a_anual(conn)

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
    -- color_idx: índice (0-5) sobre la paleta de acentos ACC elegido a mano por
    -- el usuario; si es NULL, se usa el rotativo automático (id % 6) de siempre.
    CREATE TABLE IF NOT EXISTS tarjetas (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        banco         TEXT NOT NULL,
        nombre        TEXT NOT NULL UNIQUE,
        limite        REAL NOT NULL CHECK (limite > 0),
        dia_corte     INTEGER NOT NULL CHECK (dia_corte BETWEEN 1 AND 31),
        dia_pago      INTEGER NOT NULL CHECK (dia_pago BETWEEN 1 AND 31),
        saldo_inicial REAL NOT NULL DEFAULT 0,
        activa        INTEGER NOT NULL DEFAULT 1,
        color_idx     INTEGER CHECK (color_idx BETWEEN 0 AND 5),
        marca         TEXT CHECK (marca IN ('Visa', 'Mastercard'))
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

    -- Ahorros: fondo de emergencia y metas de compra (celular, laptop...).
    --
    -- MODELO DE SOBRE, y esto es lo que hay que entender antes de tocar nada:
    -- un ahorro NO guarda plata propia. Es una etiqueta sobre el dinero que ya
    -- está en `cuentas`. Apartar Q500 no cambia tu saldo total — marca que
    -- Q500 de lo que tenés están comprometidos. Por eso los ahorros JAMÁS se
    -- suman a dinero_total: se restan de él para calcular lo que queda libre.
    -- Si algún día se sumaran, la app te contaría la misma plata dos veces.
    --
    -- El objetivo se expresa de dos formas excluyentes:
    --   · `objetivo`     — monto fijo en Q (las metas: "Q4,000 para el celular")
    --   · `meses_gastos` — múltiplo del gasto mensual promedio real (el fondo
    --     de emergencia: "3 meses"). Se recalcula solo cuando cambia tu nivel
    --     de gasto, que es como se mide un fondo de emergencia.
    CREATE TABLE IF NOT EXISTS ahorros (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre         TEXT NOT NULL UNIQUE,
        tipo           TEXT NOT NULL CHECK (tipo IN ('emergencia', 'meta')),
        objetivo       REAL CHECK (objetivo > 0),
        meses_gastos   REAL CHECK (meses_gastos > 0),
        fecha_objetivo TEXT,
        nota           TEXT NOT NULL DEFAULT '',
        color_idx      INTEGER CHECK (color_idx BETWEEN 0 AND 5),
        activo         INTEGER NOT NULL DEFAULT 1,
        -- Uno de los dos objetivos, no los dos ni ninguno.
        CHECK ((objetivo IS NULL) <> (meses_gastos IS NULL))
    );

    -- Movimientos de un sobre. El monto puede ser NEGATIVO: así se registra
    -- sacar plata del ahorro (usar el fondo de emergencia, o devolver algo que
    -- se había apartado de más). Por eso el CHECK es `<> 0` y no `> 0` como en
    -- el resto de las tablas de esta base.
    CREATE TABLE IF NOT EXISTS aportes_ahorro (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha     TEXT NOT NULL,
        ahorro_id INTEGER NOT NULL REFERENCES ahorros(id),
        monto     REAL NOT NULL CHECK (monto <> 0),
        nota      TEXT NOT NULL DEFAULT ''
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
        frecuencia   TEXT NOT NULL DEFAULT 'Mensual'
                     CHECK (frecuencia IN ('Mensual', 'Quincenal', 'Anual')),
        dia_mes_2    INTEGER CHECK (dia_mes_2 BETWEEN 1 AND 31),
        -- Solo para frecuencia 'Anual': en qué mes cae cada pago. Es lo que
        -- permite representar el Bono 14 (un pago en julio) y el aguinaldo
        -- (mitad en diciembre, mitad en enero). En Mensual/Quincenal van NULL:
        -- ahí el pago ocurre todos los meses y el mes no discrimina nada.
        mes_1        INTEGER CHECK (mes_1 BETWEEN 1 AND 12),
        mes_2        INTEGER CHECK (mes_2 BETWEEN 1 AND 12),
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
        frecuencia   TEXT NOT NULL DEFAULT 'Mensual'
                     CHECK (frecuencia IN ('Mensual', 'Quincenal', 'Anual')),
        dia_mes_2    INTEGER CHECK (dia_mes_2 BETWEEN 1 AND 31),
        -- Solo para 'Anual', igual que en ingresos_recurrentes: en qué mes cae
        -- cada pago. Es lo que permite registrar un seguro, el impuesto de
        -- circulación o una colegiatura anual, que antes no tenían dónde vivir.
        mes_1        INTEGER CHECK (mes_1 BETWEEN 1 AND 12),
        mes_2        INTEGER CHECK (mes_2 BETWEEN 1 AND 12),
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

    -- Préstamos (banco/financiera): saldo = saldo_inicial - pagos_prestamos,
    -- mismo esquema que tarjetas/pagos_tarjetas (no es un gasto recurrente
    -- con confirmaciones: el pago se registra a mano cuando el usuario quiere).
    CREATE TABLE IF NOT EXISTS prestamos (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre         TEXT NOT NULL,
        institucion    TEXT NOT NULL,
        monto_original REAL NOT NULL CHECK (monto_original > 0),
        saldo_inicial  REAL NOT NULL DEFAULT 0,
        cuota_mensual  REAL NOT NULL CHECK (cuota_mensual > 0),
        tasa_interes   REAL,
        dia_pago       INTEGER CHECK (dia_pago BETWEEN 1 AND 31),
        fecha_inicio   TEXT,
        activo         INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS pagos_prestamos (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha       TEXT NOT NULL,
        prestamo_id INTEGER NOT NULL REFERENCES prestamos(id),
        cuenta_id   INTEGER REFERENCES cuentas(id),
        monto       REAL NOT NULL CHECK (monto > 0)
    );

    -- Visa Cuotas: una compra de tarjeta diferida a cuotas fijas (no es
    -- parte del saldo revolvente de la tarjeta). tarjeta_id es obligatoria:
    -- una Visa Cuotas siempre está atada a la tarjeta donde se difirió.
    CREATE TABLE IF NOT EXISTS visacuotas (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        descripcion   TEXT NOT NULL,
        tarjeta_id    INTEGER NOT NULL REFERENCES tarjetas(id),
        monto_total   REAL NOT NULL CHECK (monto_total > 0),
        num_cuotas    INTEGER NOT NULL CHECK (num_cuotas > 0),
        cuota_mensual REAL NOT NULL CHECK (cuota_mensual > 0),
        fecha_inicio  TEXT NOT NULL,
        dia_pago      INTEGER CHECK (dia_pago BETWEEN 1 AND 31),
        activo        INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS pagos_visacuotas (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha        TEXT NOT NULL,
        visacuota_id INTEGER NOT NULL REFERENCES visacuotas(id),
        cuenta_id    INTEGER REFERENCES cuentas(id),
        monto        REAL NOT NULL CHECK (monto > 0)
    );
    """)

    # Migraciones: agregar columnas nuevas a bases creadas con versiones anteriores
    _asegurar_columna(cur, "tarjetas", "saldo_inicial", "saldo_inicial REAL NOT NULL DEFAULT 0")
    _asegurar_columna(cur, "tarjetas", "color_idx", "color_idx INTEGER")
    # Red de la tarjeta ('Visa' | 'Mastercard' | NULL). Antes la cara de la
    # tarjeta la adivinaba del nombre ("Visa BI" -> VISA), así que una tarjeta
    # llamada "Crédito BI" no mostraba ninguna. Ahora es un dato del usuario y
    # la inferencia por nombre queda solo como respaldo para las filas viejas.
    _asegurar_columna(cur, "tarjetas", "marca", "marca TEXT")
    # Valores tomados del resumen del banco (se cargan a mano, opcionales):
    # saldo al día, saldo al corte y monto para pago al contado del resumen.
    _asegurar_columna(cur, "tarjetas", "saldo_dia", "saldo_dia REAL")
    _asegurar_columna(cur, "tarjetas", "saldo_corte", "saldo_corte REAL")
    _asegurar_columna(cur, "tarjetas", "pago_contado", "pago_contado REAL")
    # Fecha (ISO) en que se cargaron/cambiaron esos valores del resumen; sirve
    # para marcarlos como viejos si ya cerró un corte nuevo desde entonces.
    _asegurar_columna(cur, "tarjetas", "resumen_actualizado", "resumen_actualizado TEXT")
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


_DDL_INGRESOS_REC = """
    CREATE TABLE {nombre} (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        descripcion  TEXT NOT NULL,
        categoria_id INTEGER NOT NULL REFERENCES categorias(id),
        monto        REAL NOT NULL CHECK (monto > 0),
        dia_mes      INTEGER NOT NULL CHECK (dia_mes BETWEEN 1 AND 31),
        frecuencia   TEXT NOT NULL DEFAULT 'Mensual'
                     CHECK (frecuencia IN ('Mensual', 'Quincenal', 'Anual')),
        dia_mes_2    INTEGER CHECK (dia_mes_2 BETWEEN 1 AND 31),
        mes_1        INTEGER CHECK (mes_1 BETWEEN 1 AND 12),
        mes_2        INTEGER CHECK (mes_2 BETWEEN 1 AND 12),
        activo       INTEGER NOT NULL DEFAULT 1
    )
"""

_DDL_GASTOS_REC = """
    CREATE TABLE {nombre} (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        descripcion  TEXT NOT NULL,
        categoria_id INTEGER NOT NULL REFERENCES categorias(id),
        monto        REAL NOT NULL CHECK (monto > 0),
        dia_mes      INTEGER NOT NULL CHECK (dia_mes BETWEEN 1 AND 31),
        frecuencia   TEXT NOT NULL DEFAULT 'Mensual'
                     CHECK (frecuencia IN ('Mensual', 'Quincenal', 'Anual')),
        dia_mes_2    INTEGER CHECK (dia_mes_2 BETWEEN 1 AND 31),
        mes_1        INTEGER CHECK (mes_1 BETWEEN 1 AND 12),
        mes_2        INTEGER CHECK (mes_2 BETWEEN 1 AND 12),
        metodo       TEXT NOT NULL DEFAULT 'Efectivo'
                     CHECK (metodo IN ('Efectivo', 'Débito', 'Transferencia', 'Tarjeta')),
        tarjeta_id   INTEGER REFERENCES tarjetas(id),
        cuenta_id    INTEGER REFERENCES cuentas(id),
        activo       INTEGER NOT NULL DEFAULT 1
    )
"""

# Las dos tablas de recurrentes se migran igual; solo cambian el nombre, el
# DDL y qué columnas hay que copiar.
_A_ANUAL = [
    ("ingresos_recurrentes", _DDL_INGRESOS_REC,
     "id, descripcion, categoria_id, monto, dia_mes, frecuencia, dia_mes_2, activo"),
    ("gastos_recurrentes", _DDL_GASTOS_REC,
     "id, descripcion, categoria_id, monto, dia_mes, frecuencia, dia_mes_2, "
     "metodo, tarjeta_id, cuenta_id, activo"),
]


def _migrar_a_anual(conn):
    """
    Habilita la frecuencia 'Anual' en las dos tablas de recurrentes.

    Los ingresos la necesitan para el Bono 14 y el aguinaldo; los gastos, para
    lo que se paga una vez al año — un seguro, el impuesto de circulación,
    una colegiatura.

    El CHECK de `frecuencia` vive dentro del CREATE TABLE y SQLite no permite
    modificar una restricción de una tabla existente: en una base que ya
    venía de antes, el CHECK viejo sigue vigente y RECHAZA cualquier fila
    'Anual' — la app aceptaría el dato en el formulario y explotaría al
    guardar. Hay que recrear la tabla y copiar las filas.

    OJO CON EL ORDEN. La primera versión de esta migración hacía
    `ALTER TABLE ingresos_recurrentes RENAME TO _viejo`, y eso ROMPIÓ la base
    de desarrollo: desde SQLite 3.25 un RENAME reescribe las referencias que
    OTRAS tablas le hacen, así que las FK de `ingresos` y de
    `recurrentes_confirmaciones` pasaron a apuntar a `_viejo`... que después
    se borraba. Resultado: FK colgada y esas tablas inutilizables.

    Por eso se usa el procedimiento que recomienda la documentación de
    SQLite: crear la tabla nueva con un nombre TEMPORAL, copiar, borrar la
    vieja y recién entonces renombrar la nueva al nombre definitivo. Ese
    último RENAME solo reescribiría referencias al nombre temporal (no hay
    ninguna), y las FK que apuntan al nombre real quedan correctas.
    """
    cur = conn.cursor()
    for tabla, ddl, columnas in _A_ANUAL:
        fila = cur.execute(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name=?", (tabla,)
        ).fetchone()
        if not fila:
            continue          # base nueva: el CREATE TABLE IF NOT EXISTS la hace bien
        if "'Anual'" in (fila[0] or ""):
            continue          # ya migrada

        # Las FK se apagan durante el trasvase: estas tablas son padre de sus
        # confirmaciones y con las FK activas el DROP falla si hay filas
        # guardadas. El pragma no funciona dentro de una transacción, de ahí
        # el commit previo.
        conn.commit()
        cur.execute("PRAGMA foreign_keys=OFF")
        try:
            temporal = f"_{tabla}_nuevo"
            cur.execute(ddl.format(nombre=temporal))
            # Columnas explícitas: la tabla vieja no tiene mes_1/mes_2 y un
            # INSERT..SELECT * fallaría por cantidad de columnas.
            cur.execute(f"INSERT INTO {temporal} ({columnas}) "
                        f"SELECT {columnas} FROM {tabla}")
            cur.execute(f"DROP TABLE {tabla}")
            cur.execute(f"ALTER TABLE {temporal} RENAME TO {tabla}")
            conn.commit()
        finally:
            cur.execute("PRAGMA foreign_keys=ON")


def _migrar_visacuotas_tarjeta_obligatoria(cur):
    """
    tarjeta_id pasó de opcional a NOT NULL en visacuotas (una Visa Cuotas
    siempre está atada a una tarjeta). SQLite no soporta agregar un NOT NULL
    a una columna existente, así que si la tabla ya existe con el esquema
    viejo (columna nullable) y no tiene filas huérfanas sin tarjeta, se
    recrea vacía con el esquema nuevo (el CREATE TABLE IF NOT EXISTS de
    abajo la vuelve a crear). Si hay huérfanas reales, no se toca nada —
    ese caso no debería darse todavía (feature nueva).
    """
    existe = cur.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='visacuotas'"
    ).fetchone()
    if not existe:
        return
    col = next((c for c in cur.execute("PRAGMA table_info(visacuotas)").fetchall() if c[1] == "tarjeta_id"), None)
    if col and col[3] == 0:  # notnull == 0 → esquema viejo (nullable)
        huerfanas = cur.execute("SELECT COUNT(*) FROM visacuotas WHERE tarjeta_id IS NULL").fetchone()[0]
        if huerfanas == 0:
            cur.execute("DROP TABLE visacuotas")


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


def saldo_prestamo(conn, prestamo_id):
    """Saldo pendiente de un préstamo = saldo inicial − pagos ya hechos."""
    inicial = conn.execute(
        "SELECT saldo_inicial FROM prestamos WHERE id = ?", (prestamo_id,)
    ).fetchone()["saldo_inicial"]
    pagos = conn.execute(
        "SELECT COALESCE(SUM(monto), 0) AS t FROM pagos_prestamos WHERE prestamo_id = ?", (prestamo_id,)
    ).fetchone()["t"]
    return round(inicial - pagos, 2)


def saldo_visacuota(conn, visacuota_id):
    """Saldo pendiente y cuotas pagadas de una Visa Cuotas (monto_total − pagos)."""
    total = conn.execute(
        "SELECT monto_total FROM visacuotas WHERE id = ?", (visacuota_id,)
    ).fetchone()["monto_total"]
    fila = conn.execute(
        "SELECT COALESCE(SUM(monto), 0) AS t, COUNT(*) AS n FROM pagos_visacuotas WHERE visacuota_id = ?",
        (visacuota_id,),
    ).fetchone()
    return round(total - fila["t"], 2), fila["n"]


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


def _col(fila, nombre):
    """
    Lee una columna que puede no existir en la fila.

    `sqlite3.Row` levanta IndexError si se pide una columna ausente, y las dos
    tablas de recurrentes NO tienen las mismas: `ingresos_recurrentes` tiene
    mes_1/mes_2 (para los anuales) y `gastos_recurrentes` no. Esto es lo que
    permite que un mismo motor sirva a las dos.
    """
    return fila[nombre] if nombre in fila.keys() else None


def ocurrencias_del_mes(fila, mes):
    """
    Qué pagos de un recurrente caen en `mes`, como [(indice, dia), ...].

    El índice es 1 o 2 y es lo que se guarda en las tablas de confirmaciones
    (la columna se llama `quincena` por razones históricas, pero para un anual
    significa "primer o segundo pago del año").

        Mensual   -> [(1, dia_mes)]                    todos los meses
        Quincenal -> [(1, dia_mes), (2, dia_mes_2)]    todos los meses
        Anual     -> solo si mes coincide con mes_1 o mes_2

    Función PURA (no toca la base) porque así se puede probar el calendario sin
    montar filas reales, que es la parte donde de verdad se cometen errores.
    """
    if fila["frecuencia"] == "Anual":
        ocurrencias = []
        if _col(fila, "mes_1") == mes:
            ocurrencias.append((1, fila["dia_mes"]))
        if _col(fila, "mes_2") == mes:
            ocurrencias.append((2, _col(fila, "dia_mes_2") or fila["dia_mes"]))
        return ocurrencias

    ocurrencias = [(1, fila["dia_mes"])]
    if fila["frecuencia"] == "Quincenal" and _col(fila, "dia_mes_2"):
        ocurrencias.append((2, fila["dia_mes_2"]))
    return ocurrencias


def etiqueta_ocurrencia(fila, indice):
    """
    Cómo se nombra una ocurrencia en el aviso de pendientes.

    Un mensual es solo su descripción; los que tienen dos pagos necesitan decir
    cuál de los dos es, o los dos avisos del mes se ven idénticos.
    """
    if fila["frecuencia"] == "Quincenal":
        return f'{fila["descripcion"]} (quincena {indice})'
    if fila["frecuencia"] == "Anual" and _col(fila, "mes_2"):
        # Aguinaldo: "pago 1 de 2" (diciembre) y "pago 2 de 2" (enero)
        return f'{fila["descripcion"]} (pago {indice} de 2)'
    return fila["descripcion"]


def ingreso_mensual_recurrente(conn):
    """
    Suma de los ingresos recurrentes activos, normalizada a UN mes.

    El monto guardado es siempre POR PAGO, así que hay que multiplicarlo por
    cuántos pagos caen en un mes:
        Quincenal -> dos pagos al mes        -> x2
        Anual     -> uno o dos pagos AL AÑO  -> /12 (prorrateado)
        Mensual   -> tal cual
    Lo anual prorrateado importa: un Bono 14 de Q8,000 contado como mensual
    inflaba la referencia en Q8,000 y hacía que el % de endeudamiento se viera
    sano cuando no lo está.

    Vive acá y no en app.py porque es una REGLA DE NEGOCIO que necesitan dos
    lugares distintos (la referencia de endeudamiento del dashboard y la
    capacidad de ahorro). Estuvo copiada en los dos y era exactamente el tipo
    de duplicado que se desincroniza: al cambiar cómo se prorratea el Bono 14
    se corrige una copia y la otra sigue mintiendo.
    """
    total = 0.0
    for r in conn.execute(
        "SELECT monto, frecuencia, mes_2 FROM ingresos_recurrentes WHERE activo = 1"
    ):
        if r["frecuencia"] == "Quincenal":
            factor = 2
        elif r["frecuencia"] == "Anual":
            factor = (2 if r["mes_2"] else 1) / 12
        else:
            factor = 1
        total += r["monto"] * factor
    return round(total, 2)


def saldo_ahorro(conn, ahorro_id):
    """Cuánto hay apartado en un sobre = suma de sus aportes (los retiros son negativos)."""
    total = conn.execute(
        "SELECT COALESCE(SUM(monto), 0) AS t FROM aportes_ahorro WHERE ahorro_id = ?",
        (ahorro_id,),
    ).fetchone()["t"]
    return round(total, 2)


def total_apartado(conn):
    """
    Suma de todos los sobres activos. Es lo que hay que RESTAR del dinero en
    cuentas para saber cuánto queda libre — nunca sumar (ver el comentario del
    esquema de `ahorros`).
    """
    total = conn.execute(
        """SELECT COALESCE(SUM(a.monto), 0) AS t FROM aportes_ahorro a
           JOIN ahorros h ON h.id = a.ahorro_id WHERE h.activo = 1"""
    ).fetchone()["t"]
    return round(total, 2)


def gasto_mensual_promedio(conn, meses=6):
    """
    Gasto promedio de los últimos `meses` meses COMPLETOS (sin contar el mes en
    curso, que siempre va a la mitad y tiraría el promedio para abajo).

    Es la base del objetivo del fondo de emergencia. Solo promedia los meses
    que efectivamente tienen gastos registrados: en una base recién empezada,
    dividir entre 6 daría un objetivo ridículamente bajo y el fondo se vería
    "completo" sin estarlo. Devuelve None si todavía no hay historial.
    """
    filas = conn.execute(
        """SELECT strftime('%Y-%m', fecha) AS ym, SUM(monto) AS t
           FROM gastos
           WHERE strftime('%Y-%m', fecha) < strftime('%Y-%m', 'now')
           GROUP BY ym ORDER BY ym DESC LIMIT ?""",
        (meses,),
    ).fetchall()
    if not filas:
        return None
    return round(sum(f["t"] for f in filas) / len(filas), 2)


def objetivo_ahorro(conn, fila, promedio=None):
    """
    Objetivo en quetzales de un sobre.

    Las metas lo traen fijo. El fondo de emergencia lo deriva del gasto
    promedio (meses_gastos × promedio) y devuelve None mientras no haya
    historial suficiente — mejor no mostrar meta que mostrar una inventada.
    `promedio` se puede pasar ya calculado para no repetir la consulta al
    listar varios sobres.
    """
    if fila["objetivo"] is not None:
        return round(fila["objetivo"], 2)
    if promedio is None:
        promedio = gasto_mensual_promedio(conn)
    if not promedio:
        return None
    return round(fila["meses_gastos"] * promedio, 2)


def saldo_cuentas_hasta(conn, ym):
    """Suma de saldos de cuentas activas considerando solo movimientos hasta el mes ym ('aaaa-mm')."""
    base = conn.execute("SELECT COALESCE(SUM(saldo_inicial), 0) t FROM cuentas WHERE activa = 1").fetchone()["t"]
    ingresos = conn.execute(
        """SELECT COALESCE(SUM(monto), 0) t FROM ingresos
           WHERE cuenta_id IN (SELECT id FROM cuentas WHERE activa = 1)
             AND strftime('%Y-%m', fecha) <= ?""", (ym,)).fetchone()["t"]
    gastos = conn.execute(
        """SELECT COALESCE(SUM(monto), 0) t FROM gastos
           WHERE cuenta_id IN (SELECT id FROM cuentas WHERE activa = 1)
             AND strftime('%Y-%m', fecha) <= ?""", (ym,)).fetchone()["t"]
    pagos = conn.execute(
        """SELECT COALESCE(SUM(monto), 0) t FROM pagos_tarjetas
           WHERE cuenta_id IN (SELECT id FROM cuentas WHERE activa = 1)
             AND strftime('%Y-%m', fecha) <= ?""", (ym,)).fetchone()["t"]
    return base + ingresos - gastos - pagos


def saldo_tarjetas_hasta(conn, ym):
    """Suma de deuda de tarjetas activas considerando solo movimientos hasta el mes ym ('aaaa-mm')."""
    base = conn.execute("SELECT COALESCE(SUM(saldo_inicial), 0) t FROM tarjetas WHERE activa = 1").fetchone()["t"]
    gastos = conn.execute(
        """SELECT COALESCE(SUM(monto), 0) t FROM gastos
           WHERE tarjeta_id IN (SELECT id FROM tarjetas WHERE activa = 1)
             AND strftime('%Y-%m', fecha) <= ?""", (ym,)).fetchone()["t"]
    pagos = conn.execute(
        """SELECT COALESCE(SUM(monto), 0) t FROM pagos_tarjetas
           WHERE tarjeta_id IN (SELECT id FROM tarjetas WHERE activa = 1)
             AND strftime('%Y-%m', fecha) <= ?""", (ym,)).fetchone()["t"]
    return base + gastos - pagos
