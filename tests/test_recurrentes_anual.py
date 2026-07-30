"""
Ingresos recurrentes anuales: Bono 14 y aguinaldo.

Las dos prestaciones anuales obligatorias de Guatemala:
  · Bono 14 (Decreto 42-92): un pago en julio.
  · Aguinaldo (Decreto 76-78): mitad en diciembre, mitad en enero.

Lo que se prueba acá es que un anual SOLO aparezca en su mes. Es el riesgo
real de la feature: si la condición del mes falla, la app te avisa doce veces
al año que cobres el Bono 14.
"""
import pytest

import db
from conftest import id_categoria


BASE = {
    "descripcion": "Bono 14", "monto": 8000.0, "dia_mes": 15,
    "frecuencia": "Anual", "mes_1": 7, "activo": True,
}


@pytest.fixture
def cat_bono(base):
    return id_categoria(base, "Bono 14", "ingreso")


def crear(cliente, cat_id, **extra):
    r = cliente.post("/api/recurrentes", json={**BASE, "categoria_id": cat_id, **extra})
    assert r.status_code == 200, r.text
    return r.json()["id"]


# ---------- Categorías ----------

def test_bono14_y_aguinaldo_son_categorias_propias(base):
    nombres = {f["nombre"] for f in base.execute(
        "SELECT nombre FROM categorias WHERE tipo = 'ingreso'")}
    # Si cayeran dentro de "Salario", julio y diciembre aparecerían como meses
    # de ingreso el doble de alto sin explicación en el análisis.
    assert {"Bono 14", "Aguinaldo"} <= nombres


# ---------- Alta y validación ----------

def test_crear_anual_guarda_el_mes(cliente, cat_bono, base):
    crear(cliente, cat_bono)
    fila = base.execute("SELECT frecuencia, mes_1, mes_2 FROM ingresos_recurrentes").fetchone()
    assert (fila["frecuencia"], fila["mes_1"], fila["mes_2"]) == ("Anual", 7, None)


def test_anual_sin_mes_se_rechaza(cliente, cat_bono):
    r = cliente.post("/api/recurrentes", json={**BASE, "categoria_id": cat_bono, "mes_1": None})
    assert r.status_code == 400


def test_los_dos_pagos_anuales_no_pueden_caer_en_el_mismo_mes(cliente, cat_bono):
    r = cliente.post("/api/recurrentes",
                     json={**BASE, "categoria_id": cat_bono, "mes_1": 12, "mes_2": 12})
    assert r.status_code == 400


def test_frecuencia_desconocida_se_rechaza(cliente, cat_bono):
    r = cliente.post("/api/recurrentes",
                     json={**BASE, "categoria_id": cat_bono, "frecuencia": "Trimestral"})
    assert r.status_code == 400


def test_pasar_de_anual_a_mensual_limpia_los_meses(cliente, cat_bono, base):
    rid = crear(cliente, cat_bono)
    cliente.put(f"/api/recurrentes/{rid}", json={
        **BASE, "categoria_id": cat_bono, "frecuencia": "Mensual", "mes_1": None,
    })
    fila = base.execute("SELECT frecuencia, mes_1, mes_2 FROM ingresos_recurrentes").fetchone()
    # Si mes_1 quedara con el 7 viejo, la fila diría "Mensual" pero arrastraría
    # datos de otra frecuencia.
    assert (fila["frecuencia"], fila["mes_1"], fila["mes_2"]) == ("Mensual", None, None)


# ---------- Lo importante: solo aparece en su mes ----------

def test_bono14_aparece_en_julio_despues_del_dia(cliente, cat_bono, en_fecha):
    crear(cliente, cat_bono)
    en_fecha(2026, 7, 20)  # ya pasó el 15
    pendientes = cliente.get("/api/recurrentes/pendientes").json()
    assert [p["descripcion"] for p in pendientes] == ["Bono 14"]


def test_bono14_no_aparece_antes_de_su_dia(cliente, cat_bono, en_fecha):
    crear(cliente, cat_bono)
    en_fecha(2026, 7, 3)  # todavía no es 15
    assert cliente.get("/api/recurrentes/pendientes").json() == []


@pytest.mark.parametrize("mes", [1, 2, 6, 8, 11, 12])
def test_bono14_no_aparece_en_ningun_otro_mes(cliente, cat_bono, en_fecha, mes):
    crear(cliente, cat_bono)
    en_fecha(2026, mes, 28)
    assert cliente.get("/api/recurrentes/pendientes").json() == []


def test_aguinaldo_aparece_en_diciembre_y_en_enero(cliente, base, en_fecha):
    cat = id_categoria(base, "Aguinaldo", "ingreso")
    cliente.post("/api/recurrentes", json={
        "descripcion": "Aguinaldo", "categoria_id": cat, "monto": 4000.0,
        "frecuencia": "Anual", "dia_mes": 15, "mes_1": 12,
        "dia_mes_2": 20, "mes_2": 1, "activo": True,
    })

    en_fecha(2026, 12, 16)
    dic = cliente.get("/api/recurrentes/pendientes").json()
    assert len(dic) == 1 and dic[0]["quincena"] == 1
    assert dic[0]["etiqueta"] == "Aguinaldo (pago 1 de 2)"

    en_fecha(2027, 1, 25)
    ene = cliente.get("/api/recurrentes/pendientes").json()
    assert len(ene) == 1 and ene[0]["quincena"] == 2
    assert ene[0]["fecha_sugerida"] == "2027-01-20"

    en_fecha(2026, 11, 30)
    assert cliente.get("/api/recurrentes/pendientes").json() == []


def test_confirmar_un_pago_anual_no_calla_al_otro(cliente, base, en_fecha):
    cat = id_categoria(base, "Aguinaldo", "ingreso")
    rid = cliente.post("/api/recurrentes", json={
        "descripcion": "Aguinaldo", "categoria_id": cat, "monto": 4000.0,
        "frecuencia": "Anual", "dia_mes": 15, "mes_1": 12,
        "dia_mes_2": 20, "mes_2": 1, "activo": True,
    }).json()["id"]

    en_fecha(2026, 12, 16)
    cliente.post(f"/api/recurrentes/{rid}/confirmar", json={"monto": 4000.0, "quincena": 1})
    assert cliente.get("/api/recurrentes/pendientes").json() == []

    # Enero es otro anio_mes: el pago de enero sigue pendiente.
    en_fecha(2027, 1, 25)
    assert len(cliente.get("/api/recurrentes/pendientes").json()) == 1


# ---------- El anual no debe inflar la referencia de ingreso mensual ----------

def test_el_anual_se_prorratea_en_la_referencia_mensual(cliente, base, en_fecha):
    salario = id_categoria(base, "Salario", "ingreso")
    cliente.post("/api/recurrentes", json={
        "descripcion": "Salario", "categoria_id": salario, "monto": 10000.0,
        "frecuencia": "Mensual", "dia_mes": 30, "activo": True,
    })
    cliente.post("/api/recurrentes", json={
        **BASE, "categoria_id": id_categoria(base, "Bono 14", "ingreso"),
    })

    en_fecha(2026, 7, 20)
    ref = cliente.get("/api/dashboard?anio=2026&mes=7").json()["endeudamiento"]["ingreso_mensual_referencia"]

    # 10000 mensual + 8000/12 del Bono 14 = 10666.67.
    # Contarlo como mensual (18000) hacía que el % de endeudamiento se viera
    # sano cuando no lo está.
    assert ref == pytest.approx(10666.67, abs=0.01)


def test_el_anual_no_secuestra_los_dias_hasta_el_proximo_ingreso(cliente, base, en_fecha):
    salario = id_categoria(base, "Salario", "ingreso")
    cliente.post("/api/recurrentes", json={
        "descripcion": "Salario", "categoria_id": salario, "monto": 10000.0,
        "frecuencia": "Mensual", "dia_mes": 30, "activo": True,
    })
    # Bono 14 el día 15: si se tratara como mensual, "próximo ingreso" diría
    # el 15 del mes que viene en vez del 30 de este.
    cliente.post("/api/recurrentes", json={
        **BASE, "categoria_id": id_categoria(base, "Bono 14", "ingreso"),
    })

    en_fecha(2026, 7, 20)
    dias = cliente.get("/api/dashboard?anio=2026&mes=7").json()["dias_proximo_salario"]
    assert dias == 10  # del 20 al 30 de julio


# ---------- Migración desde una base con el CHECK viejo ----------

def test_una_base_vieja_acepta_anual_despues_de_migrar(tmp_path, monkeypatch):
    """
    El CHECK de `frecuencia` vive dentro del CREATE TABLE y SQLite no deja
    modificarlo. En una base creada antes de esta feature el CHECK viejo
    seguiría rechazando 'Anual', así que init_db() tiene que recrear la tabla.
    """
    import sqlite3
    ruta = tmp_path / "vieja.db"
    vieja = sqlite3.connect(ruta)
    vieja.executescript("""
        CREATE TABLE categorias (
            id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL,
            tipo TEXT NOT NULL, activa INTEGER NOT NULL DEFAULT 1,
            UNIQUE (nombre, tipo)
        );
        INSERT INTO categorias (nombre, tipo) VALUES ('Salario', 'ingreso');
        CREATE TABLE ingresos_recurrentes (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            descripcion  TEXT NOT NULL,
            categoria_id INTEGER NOT NULL REFERENCES categorias(id),
            monto        REAL NOT NULL CHECK (monto > 0),
            dia_mes      INTEGER NOT NULL CHECK (dia_mes BETWEEN 1 AND 31),
            frecuencia   TEXT NOT NULL DEFAULT 'Mensual'
                         CHECK (frecuencia IN ('Mensual', 'Quincenal')),
            dia_mes_2    INTEGER CHECK (dia_mes_2 BETWEEN 1 AND 31),
            activo       INTEGER NOT NULL DEFAULT 1
        );
        INSERT INTO ingresos_recurrentes (descripcion, categoria_id, monto, dia_mes)
        VALUES ('Salario', 1, 10000, 30);
    """)
    vieja.commit()
    vieja.close()

    monkeypatch.setattr(db, "DB_PATH", str(ruta))
    db.init_db()

    conn = db.get_conn()
    try:
        # El salario que ya existía sigue ahí, con su id.
        previo = conn.execute("SELECT id, descripcion, monto FROM ingresos_recurrentes").fetchall()
        assert len(previo) == 1
        assert previo[0]["descripcion"] == "Salario" and previo[0]["monto"] == 10000

        # Y ahora 'Anual' entra sin que el CHECK viejo lo rechace.
        conn.execute(
            "INSERT INTO ingresos_recurrentes (descripcion, categoria_id, monto, dia_mes, "
            "frecuencia, mes_1) VALUES ('Bono 14', 1, 8000, 15, 'Anual', 7)")
        conn.commit()
        assert conn.execute(
            "SELECT COUNT(*) c FROM ingresos_recurrentes").fetchone()["c"] == 2
    finally:
        conn.close()


def test_la_migracion_no_rompe_la_fk_de_confirmaciones(tmp_path, monkeypatch):
    """
    Regresión de un destrozo real: la primera versión de la migración hacía
    `ALTER TABLE ingresos_recurrentes RENAME TO _viejo`, y desde SQLite 3.25 un
    RENAME reescribe las referencias que OTRAS tablas le hacen. La FK de
    recurrentes_confirmaciones pasó a apuntar a `_viejo`, que después se
    borraba: la tabla quedaba legible pero imposible de insertar.

    Este test migra una base vieja CON confirmaciones guardadas y después
    inserta una nueva. Si la FK vuelve a quedar colgada, el INSERT explota.
    """
    import sqlite3
    ruta = tmp_path / "vieja.db"
    vieja = sqlite3.connect(ruta)
    vieja.executescript("""
        CREATE TABLE categorias (
            id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL,
            tipo TEXT NOT NULL, activa INTEGER NOT NULL DEFAULT 1,
            UNIQUE (nombre, tipo)
        );
        INSERT INTO categorias (nombre, tipo) VALUES ('Salario', 'ingreso');
        CREATE TABLE ingresos_recurrentes (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            descripcion  TEXT NOT NULL,
            categoria_id INTEGER NOT NULL REFERENCES categorias(id),
            monto        REAL NOT NULL CHECK (monto > 0),
            dia_mes      INTEGER NOT NULL CHECK (dia_mes BETWEEN 1 AND 31),
            frecuencia   TEXT NOT NULL DEFAULT 'Mensual'
                         CHECK (frecuencia IN ('Mensual', 'Quincenal')),
            dia_mes_2    INTEGER CHECK (dia_mes_2 BETWEEN 1 AND 31),
            activo       INTEGER NOT NULL DEFAULT 1
        );
        INSERT INTO ingresos_recurrentes (descripcion, categoria_id, monto, dia_mes)
        VALUES ('Salario', 1, 10000, 30);
        CREATE TABLE recurrentes_confirmaciones (
            recurrente_id INTEGER NOT NULL REFERENCES ingresos_recurrentes(id),
            anio_mes      TEXT NOT NULL,
            quincena      INTEGER NOT NULL DEFAULT 1,
            PRIMARY KEY (recurrente_id, anio_mes, quincena)
        );
        INSERT INTO recurrentes_confirmaciones (recurrente_id, anio_mes, quincena)
        VALUES (1, '2026-06', 1);
    """)
    vieja.commit()
    vieja.close()

    monkeypatch.setattr(db, "DB_PATH", str(ruta))
    db.init_db()

    conn = db.get_conn()
    try:
        ddl = conn.execute(
            "SELECT sql FROM sqlite_master WHERE name='recurrentes_confirmaciones'"
        ).fetchone()[0]
        assert "_recurrentes_viejo" not in ddl
        assert "ingresos_recurrentes" in ddl

        # La confirmación que ya existía sobrevive...
        assert conn.execute(
            "SELECT COUNT(*) c FROM recurrentes_confirmaciones").fetchone()["c"] == 1
        # ...y se pueden guardar nuevas (esto era lo que reventaba).
        conn.execute("INSERT INTO recurrentes_confirmaciones "
                     "(recurrente_id, anio_mes, quincena) VALUES (1, '2026-07', 1)")
        conn.commit()
        assert conn.execute(
            "SELECT COUNT(*) c FROM recurrentes_confirmaciones").fetchone()["c"] == 2
    finally:
        conn.close()


def test_init_db_es_idempotente_sobre_la_tabla_ya_migrada(base):
    """La migración recrea la tabla; correrla dos veces no debe duplicar nada."""
    base.execute(
        "INSERT INTO ingresos_recurrentes (descripcion, categoria_id, monto, dia_mes, "
        "frecuencia, mes_1) VALUES ('Bono 14', ?, 8000, 15, 'Anual', 7)",
        (id_categoria(base, "Bono 14", "ingreso"),))
    base.commit()

    db.init_db()

    assert base.execute("SELECT COUNT(*) c FROM ingresos_recurrentes").fetchone()["c"] == 1
