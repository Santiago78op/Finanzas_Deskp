import { api } from './cliente.js';

export const getTarjetas = (incluirInactivas = false) =>
  api(`/api/tarjetas${incluirInactivas ? '?incluir_inactivas=true' : ''}`);

export const crearTarjeta = (data) => api('/api/tarjetas', { method: 'POST', body: data });

export const actualizarTarjeta = (id, data) => api(`/api/tarjetas/${id}`, { method: 'PUT', body: data });

export const eliminarTarjeta = (id) => api(`/api/tarjetas/${id}`, { method: 'DELETE' });
