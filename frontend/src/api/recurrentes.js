// Ingresos recurrentes (salario, etc.) — ver gastosRecurrentes.js para el
// equivalente del lado de los pagos frecuentes.
import { api } from './cliente.js';

export const getRecurrentes = () => api('/api/recurrentes');
export const crearRecurrente = (data) => api('/api/recurrentes', { method: 'POST', body: data });
export const actualizarRecurrente = (id, data) => api(`/api/recurrentes/${id}`, { method: 'PUT', body: data });
export const eliminarRecurrente = (id) => api(`/api/recurrentes/${id}`, { method: 'DELETE' });

export const getRecurrentesPendientes = () => api('/api/recurrentes/pendientes');

export const confirmarRecurrente = (id, { monto, quincena }) =>
  api(`/api/recurrentes/${id}/confirmar`, { method: 'POST', body: { monto, quincena } });

export const omitirRecurrente = (id, quincena) =>
  api(`/api/recurrentes/${id}/omitir?quincena=${quincena}`, { method: 'POST' });
