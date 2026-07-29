"""
La matemática de la plata (db.py). Si algo de acá se rompe, la app te miente
sobre cuánto tenés y cuánto debés — es lo más caro que puede fallar en este
proyecto, y hasta ahora no tenía ninguna prueba.
"""
from conftest import (
    crear_cuenta, crear_gasto, crear_ingreso, crear_pago_tarjeta, crear_tarjeta,
)

import db


# ---------- Saldo de tarjeta: inicial + gastos − pagos ----------

def test_saldo_tarjeta_suma_gastos_y_resta_pagos(base):
    t = crear_tarjeta(base, saldo_inicial=500)
    crear_gasto(base, 300, tarjeta_id=t)
    crear_gasto(base, 200, tarjeta_id=t)
    crear_pago_tarjeta(base, t, 400)

    assert db.saldo_tarjeta(base, t) == 600  # 500 + 500 − 400


def test_saldo_tarjeta_sin_movimientos_es_el_inicial(base):
    t = crear_tarjeta(base, saldo_inicial=125.50)
    assert db.saldo_tarjeta(base, t) == 125.50


def test_saldo_tarjeta_no_mezcla_gastos_de_otra_tarjeta(base):
    a = crear_tarjeta(base, nombre="Visa A")
    b = crear_tarjeta(base, nombre="Visa B")
    crear_gasto(base, 999, tarjeta_id=b)

    assert db.saldo_tarjeta(base, a) == 0


def test_saldo_tarjeta_redondea_a_dos_decimales(base):
    # Tres tercios de centavo: sin el round() explícito, el float arrastra
    # residuo y la cifra que ve el usuario termina en ...0000000001.
    t = crear_tarjeta(base, saldo_inicial=0)
    for _ in range(3):
        crear_gasto(base, 0.1, tarjeta_id=t)

    assert db.saldo_tarjeta(base, t) == 0.30


# ---------- Saldo de cuenta: inicial + ingresos − gastos − pagos ----------

def test_saldo_cuenta_descuenta_pagos_de_tarjeta_hechos_desde_ella(base):
    c = crear_cuenta(base, saldo_inicial=1000)
    t = crear_tarjeta(base)
    crear_ingreso(base, 500, cuenta_id=c)
    crear_gasto(base, 200, cuenta_id=c)
    crear_pago_tarjeta(base, t, 300, cuenta_id=c)

    # 1000 + 500 − 200 − 300. El pago de tarjeta sale de la cuenta: si no se
    # restara, el dinero disponible aparecería inflado justo después de pagar.
    assert db.saldo_cuenta(base, c) == 1000


def test_saldo_cuenta_ignora_movimientos_sin_cuenta_asignada(base):
    c = crear_cuenta(base, saldo_inicial=100)
    crear_gasto(base, 50, cuenta_id=None)  # gasto en efectivo, no sale de la cuenta

    assert db.saldo_cuenta(base, c) == 100


# ---------- Cortes por mes: solo cuenta lo ocurrido hasta ym ----------

def test_saldo_cuentas_hasta_excluye_meses_posteriores(base):
    c = crear_cuenta(base, saldo_inicial=0)
    crear_ingreso(base, 100, fecha="2026-06-10", cuenta_id=c)
    crear_ingreso(base, 900, fecha="2026-08-10", cuenta_id=c)

    assert db.saldo_cuentas_hasta(base, "2026-07") == 100
    assert db.saldo_cuentas_hasta(base, "2026-08") == 1000


def test_saldo_cuentas_hasta_solo_cuenta_cuentas_activas(base):
    activa = crear_cuenta(base, nombre="Activa", saldo_inicial=700, activa=1)
    crear_cuenta(base, nombre="Cerrada", saldo_inicial=300, activa=0)
    crear_ingreso(base, 50, fecha="2026-07-01", cuenta_id=activa)

    # Una cuenta cerrada no es plata que tengas hoy.
    assert db.saldo_cuentas_hasta(base, "2026-07") == 750


def test_saldo_tarjetas_hasta_excluye_meses_posteriores(base):
    t = crear_tarjeta(base, saldo_inicial=0)
    crear_gasto(base, 200, fecha="2026-07-05", tarjeta_id=t)
    crear_gasto(base, 800, fecha="2026-09-05", tarjeta_id=t)
    crear_pago_tarjeta(base, t, 50, fecha="2026-07-25")

    assert db.saldo_tarjetas_hasta(base, "2026-07") == 150
    assert db.saldo_tarjetas_hasta(base, "2026-09") == 950


def test_saldo_tarjetas_hasta_solo_cuenta_tarjetas_activas(base):
    crear_tarjeta(base, nombre="Vigente", saldo_inicial=400, activa=1)
    crear_tarjeta(base, nombre="Cancelada", saldo_inicial=9999, activa=0)

    assert db.saldo_tarjetas_hasta(base, "2026-07") == 400


# ---------- Préstamos y Visa Cuotas ----------

def test_saldo_prestamo_resta_los_pagos(base):
    cur = base.execute(
        "INSERT INTO prestamos (nombre, institucion, monto_original, saldo_inicial, "
        "cuota_mensual, activo) VALUES ('Auto', 'BX', 50000, 30000, 1500, 1)"
    )
    base.commit()
    p = cur.lastrowid
    base.execute(
        "INSERT INTO pagos_prestamos (fecha, prestamo_id, monto) VALUES ('2026-07-01', ?, 1500)", (p,)
    )
    base.commit()

    assert db.saldo_prestamo(base, p) == 28500


def test_saldo_visacuota_devuelve_saldo_y_cuotas_pagadas(base):
    t = crear_tarjeta(base)
    cur = base.execute(
        "INSERT INTO visacuotas (descripcion, tarjeta_id, monto_total, num_cuotas, "
        "cuota_mensual, fecha_inicio, activo) VALUES ('Tele', ?, 6000, 6, 1000, '2026-06-01', 1)", (t,)
    )
    base.commit()
    v = cur.lastrowid
    for fecha in ("2026-06-01", "2026-07-01"):
        base.execute(
            "INSERT INTO pagos_visacuotas (fecha, visacuota_id, monto) VALUES (?, ?, 1000)",
            (fecha, v),
        )
    base.commit()

    saldo, pagadas = db.saldo_visacuota(base, v)
    assert saldo == 4000
    assert pagadas == 2
