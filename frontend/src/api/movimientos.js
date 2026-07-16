import { api } from './cliente.js';

// Gasto/ingreso/pago son el mismo recurso "movimiento" para editar/eliminar
// — el backend los guarda en 3 tablas distintas, esto centraliza ese mapeo
// (antes vivía duplicado palabra por palabra en MovimientosView.jsx y
// ModalEditarMovimiento.jsx).
export const RUTAS_TIPO = { ingreso: 'ingresos', gasto: 'gastos', pago: 'pagos_tarjetas' };

export const getMovimientos = (filtros = {}) => {
  const qs = new URLSearchParams(filtros).toString();
  return api('/api/movimientos' + (qs ? `?${qs}` : ''));
};

export const crearGasto = (data) => api('/api/gastos', { method: 'POST', body: data });
export const crearIngreso = (data) => api('/api/ingresos', { method: 'POST', body: data });
export const crearPago = (data) => api('/api/pagos_tarjetas', { method: 'POST', body: data });

export const actualizarMovimiento = (tipo, id, data) =>
  api(`/api/${RUTAS_TIPO[tipo]}/${id}`, { method: 'PUT', body: data });

export const eliminarMovimiento = (tipo, id) =>
  api(`/api/${RUTAS_TIPO[tipo]}/${id}`, { method: 'DELETE' });
