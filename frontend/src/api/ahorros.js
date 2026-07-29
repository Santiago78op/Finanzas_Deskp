import { api } from './cliente.js';

// Ahorros: fondo de emergencia y metas de compra.
//
// getAhorros() no devuelve solo la lista: trae también el contexto que hace
// falta para decidir cuánto apartar (dinero total, cuánto ya está apartado,
// cuánto queda libre y la capacidad de ahorro mensual). Va todo en una sola
// llamada porque la vista los muestra juntos y separarlos obligaría a
// coordinar dos respuestas para pintar una sola pantalla.
export const getAhorros = (incluirInactivos = false) =>
  api(`/api/ahorros${incluirInactivos ? '?incluir_inactivos=true' : ''}`);

export const crearAhorro = (body) => api('/api/ahorros', { method: 'POST', body });
export const actualizarAhorro = (id, body) => api(`/api/ahorros/${id}`, { method: 'PUT', body });
export const eliminarAhorro = (id) => api(`/api/ahorros/${id}`, { method: 'DELETE' });

// Aparta de una vez lo que el plan sugiere para este mes (un aporte por sobre).
export const aplicarPlan = () => api('/api/ahorros/aplicar-plan', { method: 'POST' });

export const getAportes = (id) => api(`/api/ahorros/${id}/aportes`);
// monto negativo = sacar del sobre
export const crearAporte = (id, body) => api(`/api/ahorros/${id}/aportes`, { method: 'POST', body });
export const eliminarAporte = (aporteId) =>
  api(`/api/ahorros/aportes/${aporteId}`, { method: 'DELETE' });
