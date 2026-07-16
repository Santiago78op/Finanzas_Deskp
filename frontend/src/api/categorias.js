import { api } from './cliente.js';

export const getCategorias = ({ tipo, incluirInactivas } = {}) => {
  const params = new URLSearchParams();
  if (tipo) params.set('tipo', tipo);
  if (incluirInactivas) params.set('incluir_inactivas', 'true');
  const qs = params.toString();
  return api(`/api/categorias${qs ? `?${qs}` : ''}`);
};

export const crearCategoria = (data) => api('/api/categorias', { method: 'POST', body: data });

// Mismo endpoint PUT que actualizarCategoria genérico, pero con nombre
// separado según la intención real (antes eran llamadas idénticas
// distinguibles solo por la forma del body, sin ninguna pista en el
// nombre de la función).
export const renombrarCategoria = (id, nombre) => api(`/api/categorias/${id}`, { method: 'PUT', body: { nombre } });
export const toggleCategoria = (id, activa) => api(`/api/categorias/${id}`, { method: 'PUT', body: { activa } });
