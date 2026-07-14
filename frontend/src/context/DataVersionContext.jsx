import { createContext, useCallback, useContext, useState } from 'react';

// Señal global liviana: cualquier mutación (crear/editar/borrar un
// gasto/ingreso/pago, confirmar/omitir un pendiente, etc.) llama a bump().
// Componentes que necesitan quedar "en vivo" sin depender de un remount de
// vista (el ticker global, que vive montado una sola vez arriba de todo)
// escuchan `version` en su useEffect para refetchear.
const DataVersionContext = createContext(null);

export function DataVersionProvider({ children }) {
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion(v => v + 1), []);
  return (
    <DataVersionContext.Provider value={{ version, bump }}>
      {children}
    </DataVersionContext.Provider>
  );
}

export function useDataVersion() {
  const ctx = useContext(DataVersionContext);
  if (!ctx) throw new Error('useDataVersion debe usarse dentro de <DataVersionProvider>');
  return ctx;
}
