import { api } from './cliente.js';

export const getCuentas = (incluirInactivas = false) =>
  api(`/api/cuentas${incluirInactivas ? '?incluir_inactivas=true' : ''}`);

export const crearCuenta = (data) => api('/api/cuentas', { method: 'POST', body: data });

export const actualizarCuenta = (id, data) => api(`/api/cuentas/${id}`, { method: 'PUT', body: data });
