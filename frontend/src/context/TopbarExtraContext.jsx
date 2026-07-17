import { createContext, useContext, useState } from 'react';

const TopbarExtraContext = createContext(null);

// Slot para que una vista (ej. Dashboard/Análisis) inyecte contenido en el
// topbar del Layout (ej. el selector de mes, que en FinanzasQ.dc.html vive
// pegado al título, no en una fila propia) sin que Layout necesite conocer
// el estado de cada vista.
export function TopbarExtraProvider({ children }) {
  const [extra, setExtra] = useState(null);
  return (
    <TopbarExtraContext.Provider value={{ extra, setExtra }}>
      {children}
    </TopbarExtraContext.Provider>
  );
}

export function useTopbarExtra() {
  return useContext(TopbarExtraContext);
}
