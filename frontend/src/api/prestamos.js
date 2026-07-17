import { api } from './cliente.js';

export const getPrestamos = (incluirInactivas = false) =>
  api(`/api/prestamos${incluirInactivas ? '?incluir_inactivas=true' : ''}`);

export const crearPrestamo = (data) => api('/api/prestamos', { method: 'POST', body: data });

export const actualizarPrestamo = (id, data) => api(`/api/prestamos/${id}`, { method: 'PUT', body: data });

export const eliminarPrestamo = (id) => api(`/api/prestamos/${id}`, { method: 'DELETE' });

export const crearPagoPrestamo = (data) => api('/api/pagos_prestamos', { method: 'POST', body: data });
