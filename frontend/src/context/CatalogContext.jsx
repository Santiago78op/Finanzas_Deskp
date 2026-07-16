import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getCategorias } from '../api/categorias.js';
import { getMetodosPago } from '../api/metodosPago.js';
import { getTarjetas } from '../api/tarjetas.js';
import { getCuentas } from '../api/cuentas.js';

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
        getCategorias({ tipo: 'gasto' }),
        getCategorias({ tipo: 'ingreso' }),
        getMetodosPago(),
        getTarjetas(),
        getCuentas(),
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
