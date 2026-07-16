import { api } from './cliente.js';

// Sin anio/mes (TickerGlobal) pide el mes actual según el backend.
export const getDashboard = (anio, mes) => {
  const qs = (anio != null && mes != null) ? `?anio=${anio}&mes=${mes}` : '';
  return api(`/api/dashboard${qs}`);
};
