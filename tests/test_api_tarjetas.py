"""
Contrato HTTP de /api/tarjetas, con foco en `marca` (la red Visa/Mastercard),
que es el campo más nuevo y el único con una lista cerrada de valores.
"""
from conftest import crear_tarjeta


NUEVA = {
    "banco": "BI", "nombre": "Visa BI", "limite": 10000,
    "dia_corte": 5, "dia_pago": 20, "saldo_inicial": 0, "activa": True,
}


def test_crear_tarjeta_guarda_la_marca(cliente):
    r = cliente.post("/api/tarjetas", json={**NUEVA, "marca": "Mastercard"})
    assert r.status_code == 200

    tarjetas = cliente.get("/api/tarjetas").json()
    assert [t["marca"] for t in tarjetas] == ["Mastercard"]


def test_marca_es_opcional(cliente):
    assert cliente.post("/api/tarjetas", json=NUEVA).status_code == 200
    assert cliente.get("/api/tarjetas").json()[0]["marca"] is None


def test_marca_invalida_se_rechaza(cliente):
    r = cliente.post("/api/tarjetas", json={**NUEVA, "marca": "Amex"})
    assert r.status_code == 400
    # Y no deja la tarjeta a medio crear.
    assert cliente.get("/api/tarjetas").json() == []


def test_editar_cambia_la_marca(cliente):
    cliente.post("/api/tarjetas", json={**NUEVA, "marca": "Visa"})
    tid = cliente.get("/api/tarjetas").json()[0]["id"]

    r = cliente.put(f"/api/tarjetas/{tid}", json={**NUEVA, "marca": "Mastercard"})
    assert r.status_code == 200
    assert cliente.get("/api/tarjetas").json()[0]["marca"] == "Mastercard"


def test_editar_puede_dejar_la_marca_sin_especificar(cliente):
    cliente.post("/api/tarjetas", json={**NUEVA, "marca": "Visa"})
    tid = cliente.get("/api/tarjetas").json()[0]["id"]

    cliente.put(f"/api/tarjetas/{tid}", json={**NUEVA, "marca": None})
    assert cliente.get("/api/tarjetas").json()[0]["marca"] is None


def test_nombre_duplicado_se_rechaza(cliente):
    cliente.post("/api/tarjetas", json=NUEVA)
    r = cliente.post("/api/tarjetas", json=NUEVA)

    assert r.status_code == 400
    assert len(cliente.get("/api/tarjetas").json()) == 1


def test_listar_oculta_las_inactivas_salvo_que_se_pidan(base, cliente):
    crear_tarjeta(base, nombre="Vigente", activa=1)
    crear_tarjeta(base, nombre="Cancelada", activa=0)

    assert len(cliente.get("/api/tarjetas").json()) == 1
    assert len(cliente.get("/api/tarjetas?incluir_inactivas=true").json()) == 2


def test_limite_invalido_se_rechaza(cliente):
    r = cliente.post("/api/tarjetas", json={**NUEVA, "limite": 0})
    assert r.status_code == 400


def test_dia_de_corte_fuera_de_rango_se_rechaza(cliente):
    r = cliente.post("/api/tarjetas", json={**NUEVA, "dia_corte": 32})
    assert r.status_code == 400
