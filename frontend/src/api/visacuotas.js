import { api } from './cliente.js';

export const getVisacuotas = (incluirInactivas = false) =>
  api(`/api/visacuotas${incluirInactivas ? '?incluir_inactivas=true' : ''}`);

export const crearVisacuota = (data) => api('/api/visacuotas', { method: 'POST', body: data });

export const actualizarVisacuota = (id, data) => api(`/api/visacuotas/${id}`, { method: 'PUT', body: data });

export const eliminarVisacuota = (id) => api(`/api/visacuotas/${id}`, { method: 'DELETE' });

export const crearPagoVisacuota = (data) => api('/api/pagos_visacuotas', { method: 'POST', body: data });
