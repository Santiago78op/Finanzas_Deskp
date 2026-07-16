import { api } from './cliente.js';

// GET puro para un <a href download> (el navegador necesita una URL
// navegable real, no puede ir por fetch/api()) — se deja como constante en
// vez de escrita a mano en el componente.
export const URL_EXPORT = '/api/export';

export const importarCSV = (tabla, formData) => api(`/api/import/${tabla}`, { method: 'POST', body: formData });
