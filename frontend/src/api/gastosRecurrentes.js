// Pagos frecuentes (renta, internet, colegio...) — mismo patrón que
// recurrentes.js (ingresos), del lado de los gastos.
import { api } from './cliente.js';

export const getGastosRecurrentes = () => api('/api/gastos_recurrentes');
export const crearGastoRecurrente = (data) => api('/api/gastos_recurrentes', { method: 'POST', body: data });
export const actualizarGastoRecurrente = (id, data) => api(`/api/gastos_recurrentes/${id}`, { method: 'PUT', body: data });
export const eliminarGastoRecurrente = (id) => api(`/api/gastos_recurrentes/${id}`, { method: 'DELETE' });

export const getGastosRecurrentesPendientes = () => api('/api/gastos_recurrentes/pendientes');

export const confirmarGastoRecurrente = (id, { monto, quincena }) =>
  api(`/api/gastos_recurrentes/${id}/confirmar`, { method: 'POST', body: { monto, quincena } });

export const omitirGastoRecurrente = (id, quincena) =>
  api(`/api/gastos_recurrentes/${id}/omitir?quincena=${quincena}`, { method: 'POST' });
