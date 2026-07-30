"""
El contrato de la API: qué campos exactos devuelve cada endpoint.

Por qué existe: la app se escribió con `SELECT *`, así que el esquema de la
base ERA el contrato de la API. Agregar una columna la publicaba sola (así
"funcionó" `marca` sin tocar nada), y renombrar una interna rompía el frontend
en silencio, sin que ningún test se enterara.

Estos tests comparan con `==`, no con "contiene", a propósito: atrapan tanto
que FALTE un campo (rompe la UI) como que SOBRE uno (publicaste un dato
interno sin decidirlo). Si un cambio es intencional, se actualiza la lista de
acá y eso queda en el diff — que es justamente la conversación que antes no
pasaba.
"""
import pytest

from conftest import id_categoria


# ---------- Siembra ----------

@pytest.fixture
def sembrado(cliente, base):
    """Una base con al menos una fila de cada cosa, para que ninguna lista
    llegue vacía y el contrato se pueda inspeccionar de verdad."""
    ids = {}
    ids['cuenta'] = cliente.post('/api/cuentas', json={
        'banco': 'BX', 'nombre': 'Mone', 'tipo': 'Monetaria',
        'saldo_inicial': 5000, 'activa': True}).json()['id']
    ids['tarjeta'] = cliente.post('/api/tarjetas', json={
        'banco': 'BX', 'nombre': 'Visa BX', 'limite': 10000, 'dia_corte': 5,
        'dia_pago': 20, 'saldo_inicial': 500, 'activa': True, 'marca': 'Visa',
        'saldo_dia': 100, 'saldo_corte': 200, 'pago_contado': 300}).json()['id']
    ids['prestamo'] = cliente.post('/api/prestamos', json={
        'nombre': 'Auto', 'institucion': 'BX', 'monto_original': 50000,
        'saldo_inicial': 30000, 'cuota_mensual': 1500, 'dia_pago': 5,
        'tasa_interes': 12, 'fecha_inicio': '2026-01-01', 'activo': True}).json()['id']
    ids['visacuota'] = cliente.post('/api/visacuotas', json={
        'descripcion': 'Tele', 'tarjeta_id': ids['tarjeta'], 'monto_total': 6000,
        'num_cuotas': 6, 'cuota_mensual': 1000, 'fecha_inicio': '2026-01-01',
        'dia_pago': 5, 'activo': True}).json()['id']

    cat_g = id_categoria(base, 'Otros', 'gasto')
    cat_i = id_categoria(base, 'Salario', 'ingreso')

    cliente.post('/api/ingresos', json={
        'fecha': '2026-06-01', 'descripcion': 'x', 'categoria_id': cat_i,
        'monto': 9000, 'cuenta_id': ids['cuenta']})
    cliente.post('/api/gastos', json={
        'fecha': '2026-06-05', 'descripcion': 'y', 'categoria_id': cat_g,
        'metodo': 'Tarjeta', 'tarjeta_id': ids['tarjeta'], 'monto': 400})
    cliente.post('/api/pagos_tarjetas', json={
        'fecha': '2026-06-20', 'tarjeta_id': ids['tarjeta'],
        'cuenta_id': ids['cuenta'], 'monto': 200})
    cliente.post('/api/recurrentes', json={
        'descripcion': 'Salario', 'categoria_id': cat_i, 'monto': 9000,
        'dia_mes': 1, 'frecuencia': 'Mensual', 'activo': True})
    cliente.post('/api/gastos_recurrentes', json={
        'descripcion': 'Renta', 'categoria_id': cat_g, 'monto': 2000,
        'dia_mes': 1, 'frecuencia': 'Mensual', 'metodo': 'Efectivo', 'activo': True})
    ids['ahorro'] = cliente.post('/api/ahorros', json={
        'nombre': 'Celular', 'tipo': 'meta', 'objetivo': 4000,
        'fecha_objetivo': '2026-12-01', 'nota': 'n', 'color_idx': 1,
        'activo': True}).json()['id']
    cliente.post(f'/api/ahorros/{ids["ahorro"]}/aportes',
                 json={'fecha': '2026-06-10', 'monto': 500, 'nota': 'z'})
    return ids


# ---------- Contrato de cada recurso ----------

CATEGORIA = {'activa', 'id', 'nombre', 'tipo'}

TARJETA = {
    # columnas de la tabla
    'activa', 'banco', 'color_idx', 'dia_corte', 'dia_pago', 'id', 'limite',
    'marca', 'nombre', 'pago_contado', 'resumen_actualizado', 'saldo_corte',
    'saldo_dia', 'saldo_inicial',
    # calculados
    'dias_corte', 'dias_pago', 'disponible', 'pct_uso', 'proximo_corte',
    'proximo_pago', 'resumen_vencido', 'saldo',
}

CUENTA = {'activa', 'banco', 'id', 'nombre', 'saldo', 'saldo_inicial', 'tipo'}

PRESTAMO = {
    'activo', 'cuota_mensual', 'dia_pago', 'fecha_inicio', 'id', 'institucion',
    'monto_original', 'nombre', 'saldo_inicial', 'tasa_interes',
    'dias_pago', 'pct_pagado', 'proximo_pago', 'saldo',
}

VISACUOTA = {
    'activo', 'cuota_mensual', 'descripcion', 'dia_pago', 'fecha_inicio', 'id',
    'monto_total', 'num_cuotas', 'tarjeta_id',
    'cuotas_pagadas', 'cuotas_restantes', 'dias_pago', 'proximo_pago', 'saldo',
}

RECURRENTE = {
    'activo', 'categoria', 'categoria_id', 'descripcion', 'dia_mes',
    'dia_mes_2', 'frecuencia', 'id', 'mes_1', 'mes_2', 'monto',
}

GASTO_RECURRENTE = {
    'activo', 'categoria', 'categoria_id', 'cuenta', 'cuenta_id', 'descripcion',
    'dia_mes', 'dia_mes_2', 'frecuencia', 'id', 'metodo', 'monto', 'tarjeta',
    'tarjeta_id',
}

MOVIMIENTO = {
    'categoria', 'categoria_id', 'cuenta', 'cuenta_id', 'descripcion', 'fecha',
    'id', 'metodo', 'metodo_etiqueta', 'monto', 'tarjeta', 'tarjeta_id', 'tipo',
}

APORTE = {'ahorro_id', 'fecha', 'id', 'monto', 'nota'}

AHORRO = {
    'activo', 'color_idx', 'fecha_objetivo', 'id', 'meses_gastos', 'nombre',
    'nota', 'objetivo', 'tipo',
    'completado', 'falta', 'objetivo_calculado', 'pct', 'requerido_mensual',
    'saldo',
}

# Los pendientes agregan tres campos de presentación sobre el recurrente.
EXTRA_PENDIENTE = {'etiqueta', 'fecha_sugerida', 'mes_nombre', 'quincena'}

DASHBOARD = {
    'analisis', 'anio', 'apartado_ahorros', 'balance', 'barras', 'cuentas',
    'deuda_supera_ingresos', 'deuda_total', 'dias_proximo_salario',
    'dinero_total', 'disponible_salario', 'endeudamiento', 'gastos', 'ingresos',
    'libre_para_gastar', 'mes', 'metodo_pago', 'pagos_tarjetas_mes', 'pastel',
    'patrimonio', 'patrimonio_hist', 'prestamos', 'tarjetas',
    'tendencia_categorias', 'visacuotas',
}


@pytest.mark.parametrize('ruta, esperado', [
    ('/api/categorias', CATEGORIA),
    ('/api/tarjetas', TARJETA),
    ('/api/cuentas', CUENTA),
    ('/api/prestamos', PRESTAMO),
    ('/api/visacuotas', VISACUOTA),
    ('/api/recurrentes', RECURRENTE),
    ('/api/gastos_recurrentes', GASTO_RECURRENTE),
    ('/api/movimientos', MOVIMIENTO),
    ('/api/metodos_pago', {'etiqueta', 'metodo', 'tarjeta_id'}),
])
def test_contrato_de_lista(cliente, sembrado, ruta, esperado):
    datos = cliente.get(ruta).json()
    assert datos, f'{ruta} devolvió vacío: la siembra no cubre este recurso'
    assert set(datos[0].keys()) == esperado


def test_contrato_de_aportes(cliente, sembrado):
    datos = cliente.get(f'/api/ahorros/{sembrado["ahorro"]}/aportes').json()
    assert set(datos[0].keys()) == APORTE


def test_contrato_de_ahorros(cliente, sembrado):
    d = cliente.get('/api/ahorros').json()
    assert set(d.keys()) == {
        'ahorros', 'capacidad', 'dinero_total', 'libre', 'plan',
        'requerido_mensual_total', 'total_apartado'}
    assert set(d['ahorros'][0].keys()) == AHORRO
    assert set(d['capacidad'].keys()) == {
        'cuotas_comprometidas', 'gasto_promedio', 'ingreso_mensual',
        'mensual', 'meses_historial', 'quincenal'}
    assert set(d['plan'].keys()) == {
        'asignaciones', 'capacidad_mensual', 'cubre_metas_con_fecha',
        'faltante', 'sin_asignar'}


def test_contrato_del_dashboard(cliente, sembrado):
    d = cliente.get('/api/dashboard?anio=2026&mes=6').json()
    assert set(d.keys()) == DASHBOARD
    assert set(d['endeudamiento'].keys()) == {
        'ingreso_mensual_referencia', 'pago_mensual_prestamos',
        'pago_mensual_tarjetas', 'pago_mensual_visacuotas',
        'prestamos', 'tarjetas', 'visacuotas'}
    assert set(d['analisis'].keys()) == {
        'gastos_mes_anterior', 'top_categorias', 'top_gastos'}


def test_el_dashboard_usa_el_mismo_contrato_que_las_listas(cliente, sembrado):
    """
    El dashboard reexpone tarjetas, cuentas, préstamos y Visa Cuotas. Tienen que
    salir con la MISMA forma que en su endpoint propio: si divergen, un
    componente compartido (CreditCard, AccountCard) funciona en una vista y se
    rompe en la otra.
    """
    d = cliente.get('/api/dashboard?anio=2026&mes=6').json()
    assert set(d['tarjetas'][0].keys()) == TARJETA
    assert set(d['cuentas'][0].keys()) == CUENTA
    assert set(d['prestamos'][0].keys()) == PRESTAMO
    assert set(d['visacuotas'][0].keys()) == VISACUOTA


@pytest.mark.parametrize('ruta, base_esperada', [
    ('/api/recurrentes/pendientes', RECURRENTE),
    ('/api/gastos_recurrentes/pendientes', GASTO_RECURRENTE),
])
def test_contrato_de_pendientes(cliente, sembrado, en_fecha, ruta, base_esperada):
    # Día 15: ya pasó el día 1 de los dos recurrentes sembrados.
    en_fecha(2026, 6, 15)
    datos = cliente.get(ruta).json()
    assert datos, f'{ruta} devolvió vacío'
    assert set(datos[0].keys()) == base_esperada | EXTRA_PENDIENTE


# ---------- La propiedad de fondo ----------

@pytest.mark.parametrize('tabla, ruta, esperado', [
    ('tarjetas', '/api/tarjetas', TARJETA),
    ('cuentas', '/api/cuentas', CUENTA),
    ('prestamos', '/api/prestamos', PRESTAMO),
    ('visacuotas', '/api/visacuotas', VISACUOTA),
    ('ahorros', '/api/ahorros', AHORRO),
    ('ingresos_recurrentes', '/api/recurrentes', RECURRENTE),
    ('gastos_recurrentes', '/api/gastos_recurrentes', GASTO_RECURRENTE),
    ('categorias', '/api/categorias', CATEGORIA),
])
def test_una_columna_nueva_no_se_publica_sola(cliente, base, sembrado, tabla, ruta, esperado):
    """
    LA propiedad que buscaba el paso 5: el esquema de la base ya NO es el
    contrato de la API.

    Se agrega una columna interna a la tabla y se comprueba que la respuesta
    sigue igual. Con `SELECT *` este test fallaría: la columna aparecería en el
    JSON sin que nadie lo decidiera, que es exactamente cómo `marca` "funcionó
    sola" y cómo un dato interno podría filtrarse al frontend sin revisión.

    Ojo con lo que este test NO prueba: comparar las listas de campos contra el
    esquema de hoy pasaría igual con `SELECT *`, porque hoy coinciden. Hace
    falta introducir una columna nueva para que la diferencia se vea.
    """
    base.execute(f"ALTER TABLE {tabla} ADD COLUMN _interna TEXT DEFAULT 'secreto'")
    base.commit()

    datos = cliente.get(ruta).json()
    filas = datos['ahorros'] if ruta == '/api/ahorros' else datos
    assert filas, f'{ruta} devolvió vacío'
    assert '_interna' not in filas[0], f'{ruta} publicó una columna interna'
    assert set(filas[0].keys()) == esperado
