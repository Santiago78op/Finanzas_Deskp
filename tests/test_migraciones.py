"""
Migraciones sobre bases existentes.

Importa porque la base de este proyecto NO se recrea: es un archivo con años
de datos que se migra en el arranque (`db.init_db()` -> `_asegurar_columna`).
Un error acá no da un test rojo en un repo limpio, da una app que no levanta
en la máquina donde están los datos de verdad.
"""
import sqlite3

import db


def columnas(conn, tabla):
    return {c[1] for c in conn.execute(f"PRAGMA table_info({tabla})").fetchall()}


def test_asegurar_columna_agrega_la_que_falta(base):
    base.execute("CREATE TABLE viejita (id INTEGER PRIMARY KEY)")
    cur = base.cursor()

    db._asegurar_columna(cur, "viejita", "nueva", "nueva TEXT")

    assert "nueva" in columnas(base, "viejita")


def test_asegurar_columna_es_idempotente(base):
    base.execute("CREATE TABLE viejita (id INTEGER PRIMARY KEY)")
    cur = base.cursor()

    db._asegurar_columna(cur, "viejita", "nueva", "nueva TEXT")
    # Segunda pasada: es lo que ocurre en CADA arranque de la app.
    db._asegurar_columna(cur, "viejita", "nueva", "nueva TEXT")

    assert len(columnas(base, "viejita")) == 2


def test_init_db_agrega_marca_a_una_base_sin_esa_columna(tmp_path, monkeypatch):
    """
    Simula la base de alguien que venía usando la app antes de que existiera
    la red Visa/Mastercard: se crea `tarjetas` con el esquema viejo, se corre
    init_db() y la columna tiene que aparecer sin perder la fila que ya había.
    """
    ruta = tmp_path / "vieja.db"
    vieja = sqlite3.connect(ruta)
    vieja.executescript("""
        CREATE TABLE tarjetas (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            banco         TEXT NOT NULL,
            nombre        TEXT NOT NULL UNIQUE,
            limite        REAL NOT NULL,
            dia_corte     INTEGER NOT NULL,
            dia_pago      INTEGER NOT NULL,
            saldo_inicial REAL NOT NULL DEFAULT 0,
            activa        INTEGER NOT NULL DEFAULT 1
        );
        INSERT INTO tarjetas (banco, nombre, limite, dia_corte, dia_pago)
        VALUES ('BAM', 'Visa BAM', 10000, 5, 20);
    """)
    vieja.commit()
    vieja.close()

    monkeypatch.setattr(db, "DB_PATH", str(ruta))
    db.init_db()

    conn = db.get_conn()
    try:
        assert "marca" in columnas(conn, "tarjetas")
        fila = conn.execute("SELECT nombre, marca FROM tarjetas").fetchone()
        assert fila["nombre"] == "Visa BAM"
        assert fila["marca"] is None  # sin dato previo, queda sin especificar
    finally:
        conn.close()


def test_init_db_precarga_las_categorias_una_sola_vez(base):
    antes = base.execute("SELECT COUNT(*) c FROM categorias").fetchone()["c"]
    assert antes == len(db.CATEGORIAS_GASTO) + len(db.CATEGORIAS_INGRESO)

    db.init_db()  # segundo arranque

    despues = base.execute("SELECT COUNT(*) c FROM categorias").fetchone()["c"]
    assert despues == antes
