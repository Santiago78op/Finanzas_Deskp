"""
Ahorros: fondo de emergencia y metas.

El invariante que más importa: un sobre NO guarda plata propia, etiqueta la
que ya está en las cuentas. Si algún día se sumara a `dinero_total`, la app
contaría la misma plata dos veces y diría que tenés más de lo que tenés.
"""
import pytest

import db
from conftest import crear_cuenta, crear_gasto, crear_tarjeta, id_categoria


META = {"nombre": "Celular", "tipo": "meta", "objetivo": 4000.0, "activo": True}
EMERGENCIA = {"nombre": "Fondo de emergencia", "tipo": "emergencia",
              "meses_gastos": 3, "activo": True}


def aportar(cliente, ahorro_id, monto, fecha="2026-07-10"):
    return cliente.post(f"/api/ahorros/{ahorro_id}/aportes",
                        json={"fecha": fecha, "monto": monto})


# ---------- El invariante: apartar no crea ni mueve dinero ----------

def test_apartar_no_cambia_el_dinero_total(cliente, base):
    crear_cuenta(base, saldo_inicial=4700)
    antes = cliente.get("/api/ahorros").json()["dinero_total"]

    mid = cliente.post("/api/ahorros", json=META).json()["id"]
    aportar(cliente, mid, 1500)

    despues = cliente.get("/api/ahorros").json()
    assert despues["dinero_total"] == antes == 4700
    assert despues["total_apartado"] == 1500
    assert despues["libre"] == 3200  # 4700 − 1500


def test_el_dashboard_resta_los_ahorros_no_los_suma(cliente, base):
    crear_cuenta(base, saldo_inicial=4700)
    mid = cliente.post("/api/ahorros", json=META).json()["id"]
    aportar(cliente, mid, 1500)

    d = cliente.get("/api/dashboard?anio=2026&mes=7").json()
    assert d["dinero_total"] == 4700          # NO 6200
    assert d["apartado_ahorros"] == 1500
    assert d["libre_para_gastar"] == 3200


def test_libre_puede_quedar_negativo_si_apartas_de_mas(cliente, base):
    crear_cuenta(base, saldo_inicial=1000)
    mid = cliente.post("/api/ahorros", json=META).json()["id"]
    aportar(cliente, mid, 1500)

    # No se recorta a cero: el número en rojo ES el aviso.
    assert cliente.get("/api/ahorros").json()["libre"] == -500


def test_los_ahorros_inactivos_no_cuentan_como_apartado(cliente, base):
    crear_cuenta(base, saldo_inicial=4700)
    mid = cliente.post("/api/ahorros", json=META).json()["id"]
    aportar(cliente, mid, 1500)
    cliente.put(f"/api/ahorros/{mid}", json={**META, "activo": False})

    d = cliente.get("/api/ahorros").json()
    assert d["total_apartado"] == 0 and d["libre"] == 4700


# ---------- Aportes y retiros ----------

def test_sacar_del_sobre_resta(cliente, base):
    crear_cuenta(base, saldo_inicial=4700)
    mid = cliente.post("/api/ahorros", json=META).json()["id"]
    aportar(cliente, mid, 1000)
    aportar(cliente, mid, -400)

    assert cliente.get("/api/ahorros").json()["ahorros"][0]["saldo"] == 600


def test_no_se_puede_sacar_mas_de_lo_que_hay(cliente, base):
    mid = cliente.post("/api/ahorros", json=META).json()["id"]
    aportar(cliente, mid, 100)

    r = aportar(cliente, mid, -500)
    assert r.status_code == 400
    assert cliente.get("/api/ahorros").json()["ahorros"][0]["saldo"] == 100


def test_un_aporte_de_cero_se_rechaza(cliente):
    mid = cliente.post("/api/ahorros", json=META).json()["id"]
    assert aportar(cliente, mid, 0).status_code == 400


def test_borrar_el_ahorro_borra_sus_aportes(cliente, base):
    crear_cuenta(base, saldo_inicial=4700)
    mid = cliente.post("/api/ahorros", json=META).json()["id"]
    aportar(cliente, mid, 1500)

    assert cliente.delete(f"/api/ahorros/{mid}").status_code == 200
    d = cliente.get("/api/ahorros").json()
    assert d["total_apartado"] == 0
    assert base.execute("SELECT COUNT(*) c FROM aportes_ahorro").fetchone()["c"] == 0
    # Y la cuenta ni se entera: el dinero nunca se movió.
    assert d["dinero_total"] == 4700


# ---------- Validación del objetivo ----------

def test_una_meta_necesita_objetivo_en_quetzales(cliente):
    r = cliente.post("/api/ahorros", json={"nombre": "X", "tipo": "meta"})
    assert r.status_code == 400


def test_no_se_pueden_dar_los_dos_objetivos_a_la_vez(cliente):
    r = cliente.post("/api/ahorros", json={
        "nombre": "X", "tipo": "meta", "objetivo": 100.0, "meses_gastos": 3})
    assert r.status_code == 400


def test_nombre_duplicado_se_rechaza(cliente):
    cliente.post("/api/ahorros", json=META)
    assert cliente.post("/api/ahorros", json=META).status_code == 400


# ---------- Fondo de emergencia: objetivo en meses de gastos ----------

def test_el_objetivo_de_emergencia_sale_del_gasto_promedio(cliente, base):
    # Dos meses cerrados: 2000 y 4000 -> promedio 3000; 3 meses -> 9000.
    crear_gasto(base, 2000, fecha="2026-05-10")
    crear_gasto(base, 4000, fecha="2026-06-10")

    cliente.post("/api/ahorros", json=EMERGENCIA)
    a = cliente.get("/api/ahorros").json()["ahorros"][0]
    assert a["objetivo_calculado"] == 9000


def test_el_mes_en_curso_no_entra_en_el_promedio(cliente, base, monkeypatch):
    """
    El mes actual siempre va a la mitad; incluirlo bajaría el promedio y el
    fondo se vería más completo de lo que está.
    """
    crear_gasto(base, 3000, fecha="2026-05-10")
    # Un gasto de hoy (mes en curso, sea cual sea) no debe mover el promedio.
    import datetime
    hoy = datetime.date.today().isoformat()
    crear_gasto(base, 99999, fecha=hoy)

    cliente.post("/api/ahorros", json=EMERGENCIA)
    a = cliente.get("/api/ahorros").json()["ahorros"][0]
    assert a["objetivo_calculado"] == 9000  # 3000 x 3, sin el gasto de hoy


def test_sin_historial_no_se_inventa_un_objetivo(cliente):
    cliente.post("/api/ahorros", json=EMERGENCIA)
    a = cliente.get("/api/ahorros").json()["ahorros"][0]
    # Mejor "no sé" que una meta inventada que se vería completa de entrada.
    assert a["objetivo_calculado"] is None
    assert a["pct"] is None


def test_el_progreso_se_calcula_sobre_el_objetivo(cliente, base):
    mid = cliente.post("/api/ahorros", json=META).json()["id"]
    aportar(cliente, mid, 1000)

    a = cliente.get("/api/ahorros").json()["ahorros"][0]
    assert a["pct"] == 25.0 and a["falta"] == 3000 and a["completado"] is False


def test_pasarse_del_objetivo_no_da_mas_de_cien(cliente):
    mid = cliente.post("/api/ahorros", json=META).json()["id"]
    aportar(cliente, mid, 5000)

    a = cliente.get("/api/ahorros").json()["ahorros"][0]
    assert a["pct"] == 100.0 and a["falta"] == 0 and a["completado"] is True


# ---------- Capacidad de ahorro ----------

def test_la_capacidad_descuenta_gastos_y_cuotas(cliente, base):
    salario = id_categoria(base, "Salario", "ingreso")
    cliente.post("/api/recurrentes", json={
        "descripcion": "Salario", "categoria_id": salario, "monto": 10000.0,
        "frecuencia": "Mensual", "dia_mes": 30, "activo": True})
    crear_gasto(base, 6000, fecha="2026-05-10")   # un mes cerrado -> promedio 6000
    base.execute(
        "INSERT INTO prestamos (nombre, institucion, monto_original, saldo_inicial, "
        "cuota_mensual, activo) VALUES ('Auto', 'BX', 50000, 30000, 1500, 1)")
    base.commit()

    cap = cliente.get("/api/ahorros").json()["capacidad"]
    assert cap["ingreso_mensual"] == 10000
    assert cap["gasto_promedio"] == 6000
    assert cap["cuotas_comprometidas"] == 1500
    assert cap["mensual"] == 2500      # 10000 − 6000 − 1500
    assert cap["quincenal"] == 1250


def test_la_capacidad_no_descuenta_dos_veces_las_compras_con_tarjeta(cliente, base):
    """
    Un gasto con tarjeta ya está en `gastos`. Si además se restaran los pagos
    a la tarjeta, la misma compra se descontaría dos veces y la capacidad
    saldría más baja de lo real.
    """
    salario = id_categoria(base, "Salario", "ingreso")
    cliente.post("/api/recurrentes", json={
        "descripcion": "Salario", "categoria_id": salario, "monto": 10000.0,
        "frecuencia": "Mensual", "dia_mes": 30, "activo": True})
    t = crear_tarjeta(base)
    crear_gasto(base, 2000, fecha="2026-05-10", tarjeta_id=t)
    base.execute("INSERT INTO pagos_tarjetas (fecha, tarjeta_id, monto) "
                 "VALUES ('2026-05-25', ?, 2000)", (t,))
    base.commit()

    cap = cliente.get("/api/ahorros").json()["capacidad"]
    assert cap["mensual"] == 8000  # 10000 − 2000, NO 6000


def test_una_visacuota_terminada_no_compromete_capacidad(cliente, base):
    t = crear_tarjeta(base)
    cur = base.execute(
        "INSERT INTO visacuotas (descripcion, tarjeta_id, monto_total, num_cuotas, "
        "cuota_mensual, fecha_inicio, activo) VALUES ('Tele', ?, 2000, 2, 1000, '2026-05-01', 1)",
        (t,))
    base.commit()
    v = cur.lastrowid
    for fecha in ("2026-05-01", "2026-06-01"):  # las dos cuotas pagadas
        base.execute("INSERT INTO pagos_visacuotas (fecha, visacuota_id, monto) "
                     "VALUES (?, ?, 1000)", (fecha, v))
    base.commit()

    assert cliente.get("/api/ahorros").json()["capacidad"]["cuotas_comprometidas"] == 0


def test_sin_historial_la_capacidad_no_se_inventa(cliente):
    cap = cliente.get("/api/ahorros").json()["capacidad"]
    assert cap["gasto_promedio"] is None and cap["meses_historial"] == 0


# ---------- Cuánto apartar por mes para llegar a la fecha ----------

def test_con_fecha_objetivo_dice_cuanto_apartar_por_mes(cliente, en_fecha):
    en_fecha(2026, 7, 1)

    # 4000 en ~4 meses (1 de julio -> 1 de noviembre) ≈ 1000/mes
    cliente.post("/api/ahorros", json={**META, "fecha_objetivo": "2026-11-01"})
    a = cliente.get("/api/ahorros").json()["ahorros"][0]
    assert a["requerido_mensual"] == pytest.approx(1000, abs=15)


def test_sin_fecha_objetivo_no_hay_requerido_mensual(cliente):
    cliente.post("/api/ahorros", json=META)
    assert cliente.get("/api/ahorros").json()["ahorros"][0]["requerido_mensual"] is None


def test_una_meta_completa_no_pide_nada_por_mes(cliente):
    mid = cliente.post("/api/ahorros",
                       json={**META, "fecha_objetivo": "2026-11-01"}).json()["id"]
    aportar(cliente, mid, 4000)
    assert cliente.get("/api/ahorros").json()["ahorros"][0]["requerido_mensual"] is None


# ---------- Helpers de db.py ----------

def test_total_apartado_suma_todos_los_sobres_activos(cliente, base):
    m1 = cliente.post("/api/ahorros", json=META).json()["id"]
    m2 = cliente.post("/api/ahorros", json={**META, "nombre": "Laptop"}).json()["id"]
    aportar(cliente, m1, 500)
    aportar(cliente, m2, 800)

    assert db.total_apartado(base) == 1300


# ---------- Plan sugerido: cuánto apartar en cada cosa ----------

def _con_capacidad(cliente, base, ingreso=10000, gasto=6000):
    """Deja la base con una capacidad de ahorro conocida (ingreso − gasto)."""
    salario = id_categoria(base, "Salario", "ingreso")
    cliente.post("/api/recurrentes", json={
        "descripcion": "Salario", "categoria_id": salario, "monto": float(ingreso),
        "frecuencia": "Mensual", "dia_mes": 30, "activo": True})
    crear_gasto(base, gasto, fecha="2026-05-10")   # un mes cerrado


def test_el_plan_le_da_primero_al_fondo_de_emergencia(cliente, base):
    _con_capacidad(cliente, base)                       # capacidad 4000
    cliente.post("/api/ahorros", json=EMERGENCIA)       # objetivo 3 x 6000 = 18000
    cliente.post("/api/ahorros", json=META)             # 4000

    plan = cliente.get("/api/ahorros").json()["plan"]
    # El fondo se lleva toda la capacidad: la red de seguridad va antes que el
    # celular. La meta sin fecha no recibe nada este mes.
    assert [(a["nombre"], a["mensual"]) for a in plan["asignaciones"]] == [
        ("Fondo de emergencia", 4000.0)]
    assert plan["sin_asignar"] == 0


def test_una_meta_con_fecha_cobra_antes_que_una_sin_fecha(cliente, base, en_fecha):
    en_fecha(2026, 7, 1)

    _con_capacidad(cliente, base, ingreso=10000, gasto=7000)   # capacidad 3000
    cliente.post("/api/ahorros", json={**META, "fecha_objetivo": "2026-11-01"})  # ~1000/mes
    cliente.post("/api/ahorros", json={**META, "nombre": "Laptop", "objetivo": 8000.0})

    plan = cliente.get("/api/ahorros").json()["plan"]
    porNombre = {a["nombre"]: a["mensual"] for a in plan["asignaciones"]}
    assert porNombre["Celular"] == pytest.approx(1000, abs=15)
    # A la de sin fecha le toca el resto, no una parte igual.
    assert porNombre["Laptop"] == pytest.approx(2000, abs=15)


def test_el_plan_avisa_si_no_alcanza_para_las_metas_con_fecha(cliente, base, en_fecha):
    en_fecha(2026, 7, 1)

    _con_capacidad(cliente, base, ingreso=10000, gasto=9700)   # capacidad 300
    cliente.post("/api/ahorros", json={**META, "fecha_objetivo": "2026-11-01"})  # pide ~1000

    plan = cliente.get("/api/ahorros").json()["plan"]
    assert plan["cubre_metas_con_fecha"] is False
    assert plan["faltante"] > 0


def test_sin_capacidad_no_hay_plan(cliente, base):
    _con_capacidad(cliente, base, ingreso=5000, gasto=6000)   # capacidad negativa
    cliente.post("/api/ahorros", json=META)

    plan = cliente.get("/api/ahorros").json()["plan"]
    assert plan["asignaciones"] == [] and plan["capacidad_mensual"] < 0


def test_el_plan_no_asigna_a_una_meta_ya_completa(cliente, base):
    _con_capacidad(cliente, base)
    mid = cliente.post("/api/ahorros", json=META).json()["id"]
    aportar(cliente, mid, 4000)   # completa

    plan = cliente.get("/api/ahorros").json()["plan"]
    assert plan["asignaciones"] == []
    # Lo que no se asigna se reporta, no se mete a la fuerza en algo cumplido.
    assert plan["sin_asignar"] == 4000


def test_aplicar_el_plan_crea_un_aporte_por_sobre(cliente, base):
    _con_capacidad(cliente, base)      # capacidad 4000
    cliente.post("/api/ahorros", json=META)          # 4000, sin fecha

    r = cliente.post("/api/ahorros/aplicar-plan")
    assert r.status_code == 200 and r.json()["aportes"] == 1

    d = cliente.get("/api/ahorros").json()
    assert d["ahorros"][0]["saldo"] == 4000
    assert d["total_apartado"] == 4000


def test_aplicar_el_plan_sin_capacidad_se_rechaza(cliente, base):
    _con_capacidad(cliente, base, ingreso=5000, gasto=6000)
    cliente.post("/api/ahorros", json=META)

    assert cliente.post("/api/ahorros/aplicar-plan").status_code == 400
