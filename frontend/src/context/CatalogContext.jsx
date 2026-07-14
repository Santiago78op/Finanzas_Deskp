import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api.js';

const CatalogContext = createContext(null);

export function CatalogProvider({ children }) {
  const [state, setState] = useState({
    catGasto: [], catIngreso: [], metodos: [], tarjetas: [], cuentas: [],
    loading: true, error: null,
  });

  const refetch = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const [catGasto, catIngreso, metodos, tarjetas, cuentas] = await Promise.all([
        api('/api/categorias?tipo=gasto'),
        api('/api/categorias?tipo=ingreso'),
        api('/api/metodos_pago'),
        api('/api/tarjetas'),
        api('/api/cuentas'),
      ]);
      setState({ catGasto, catIngreso, metodos, tarjetas, cuentas, loading: false, error: null });
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: err.message }));
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return (
    <CatalogContext.Provider value={{ ...state, refetch }}>
      {children}
    </CatalogContext.Provider>
  );
}

export function useCatalog() {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog debe usarse dentro de <CatalogProvider>');
  return ctx;
}
