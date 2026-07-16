import { api } from './cliente.js';

export const getEstadoNotion = () => api('/api/notion/estado');
export const checkNotion = () => api('/api/notion/check', { method: 'POST' });
export const syncNotion = () => api('/api/notion/sync', { method: 'POST' });
