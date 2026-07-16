import { api } from './cliente.js';

export const getMetodosPago = () => api('/api/metodos_pago');
