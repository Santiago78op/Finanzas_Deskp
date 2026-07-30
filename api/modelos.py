"""
Modelos de entrada (Pydantic) de la API.

Todos juntos y aparte de los routers a prop\u00f3sito: son el contrato de lo que
la app acepta, y verlos en una sola pantalla hace evidente qu\u00e9 campos
comparten unos recursos con otros.
"""
from typing import Optional

from pydantic import BaseModel


class CategoriaIn(BaseModel):
    nombre: str
    tipo: str  # 'ingreso' | 'gasto'

class CategoriaEdit(BaseModel):
    nombre: Optional[str] = None
    activa: Optional[bool] = None

class TarjetaIn(BaseModel):
    banco: str
    nombre: str
    limite: float
    dia_corte: int
    dia_pago: int
    saldo_inicial: float = 0  # deuda que ya traía la tarjeta (opcional, puede ser 0)
    activa: bool = True
    color_idx: Optional[int] = None  # índice 0-5 sobre la paleta ACC; None = rotativo automático
    marca: Optional[str] = None      # 'Visa' | 'Mastercard' | None (sin especificar)
    # Valores del resumen del banco, cargados a mano (opcionales, None = sin dato):
    saldo_dia: Optional[float] = None
    saldo_corte: Optional[float] = None
    pago_contado: Optional[float] = None

class CuentaIn(BaseModel):
    banco: str
    nombre: str
    tipo: str                 # 'Monetaria' | 'Ahorro'
    saldo_inicial: float = 0  # dinero que había al registrarla (opcional)
    activa: bool = True

class AhorroIn(BaseModel):
    nombre: str
    tipo: str                            # 'emergencia' | 'meta'
    # Excluyentes: monto fijo (metas) o múltiplo del gasto mensual (emergencia).
    objetivo: Optional[float] = None
    meses_gastos: Optional[float] = None
    fecha_objetivo: Optional[str] = None  # opcional; habilita el "cuánto por mes"
    nota: Optional[str] = ""
    color_idx: Optional[int] = None
    activo: bool = True

class AporteIn(BaseModel):
    fecha: str
    monto: float          # negativo = sacar del sobre
    nota: Optional[str] = ""

class IngresoIn(BaseModel):
    fecha: str
    descripcion: str = ""
    categoria_id: int
    monto: float
    cuenta_id: Optional[int] = None  # a qué cuenta entró (opcional)

class GastoIn(BaseModel):
    fecha: str
    descripcion: str = ""
    categoria_id: int
    metodo: str
    tarjeta_id: Optional[int] = None
    cuenta_id: Optional[int] = None  # de qué cuenta salió (Débito/Transferencia, opcional)
    monto: float

class PagoIn(BaseModel):
    fecha: str
    tarjeta_id: int
    cuenta_id: Optional[int] = None  # desde qué cuenta se pagó (opcional)
    monto: float

class PrestamoIn(BaseModel):
    nombre: str
    institucion: str
    monto_original: float
    saldo_inicial: float = 0    # saldo pendiente al registrarlo
    cuota_mensual: float
    tasa_interes: Optional[float] = None  # % anual, opcional
    dia_pago: Optional[int] = None
    fecha_inicio: Optional[str] = None
    activo: bool = True

class PagoPrestamoIn(BaseModel):
    fecha: str
    prestamo_id: int
    cuenta_id: Optional[int] = None
    monto: float

class VisacuotaIn(BaseModel):
    descripcion: str
    tarjeta_id: int  # a qué tarjeta se difirió la compra (obligatorio)
    monto_total: float
    num_cuotas: int
    cuota_mensual: float
    fecha_inicio: str
    dia_pago: Optional[int] = None
    activo: bool = True

class PagoVisacuotaIn(BaseModel):
    fecha: str
    visacuota_id: int
    cuenta_id: Optional[int] = None
    monto: float

class RecurrenteIn(BaseModel):
    descripcion: str
    categoria_id: int
    monto: float               # POR PAGO, no anual: si son dos pagos, es cada uno
    dia_mes: int
    frecuencia: str = "Mensual"      # 'Mensual' | 'Quincenal' | 'Anual'
    dia_mes_2: Optional[int] = None  # segundo día (Quincenal) o día del 2º pago (Anual)
    # Solo 'Anual': en qué mes cae cada pago. Bono 14 -> mes_1=7; aguinaldo
    # -> mes_1=12 y mes_2=1 (la ley lo parte 50/50 entre diciembre y enero).
    mes_1: Optional[int] = None
    mes_2: Optional[int] = None
    activo: bool = True

class ConfirmarIn(BaseModel):
    monto: float
    quincena: int = 1  # 1 = primer día, 2 = segundo día (solo Quincenal)

class GastoRecurrenteIn(BaseModel):
    descripcion: str
    categoria_id: int
    monto: float               # POR PAGO, no anual: si son dos pagos, es cada uno
    dia_mes: int
    frecuencia: str = "Mensual"      # 'Mensual' | 'Quincenal' | 'Anual'
    dia_mes_2: Optional[int] = None  # segundo día (Quincenal) o día del 2º pago (Anual)
    # Solo 'Anual': en qué mes cae cada pago. Un seguro, el impuesto de
    # circulación o una colegiatura se pagan una vez al año, no todos los meses.
    mes_1: Optional[int] = None
    mes_2: Optional[int] = None
    metodo: str = "Efectivo"
    tarjeta_id: Optional[int] = None
    cuenta_id: Optional[int] = None
    activo: bool = True

