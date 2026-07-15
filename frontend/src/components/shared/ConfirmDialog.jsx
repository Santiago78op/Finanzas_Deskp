import { createContext, useCallback, useContext, useState } from 'react';
import Modal from './Modal.jsx';

// Reemplaza window.confirm() (nativo del navegador, rompe la consistencia
// visual con el resto de la app — heurística 4 de Nielsen) por un modal
// propio. useConfirm() devuelve una función async: `if (!(await
// confirmar('¿Eliminar?', { peligro: true }))) return;` en vez de
// `if (!confirm('¿Eliminar?')) return;` — mismo uso, look consistente.
const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [dialogo, setDialogo] = useState(null); // { mensaje, peligro, resolve }

  const confirmar = useCallback((mensaje, opciones = {}) => {
    return new Promise(resolve => setDialogo({ mensaje, peligro: !!opciones.peligro, resolve }));
  }, []);

  const responder = (valor) => {
    dialogo?.resolve(valor);
    setDialogo(null);
  };

  return (
    <ConfirmContext.Provider value={confirmar}>
      {children}
      {dialogo && (
        <Modal
          titulo="Confirmar"
          onCerrar={() => responder(false)}
          onGuardar={() => responder(true)}
          labelGuardar="Sí, continuar"
          peligro={dialogo.peligro}
        >
          <p style={{ whiteSpace: 'pre-line' }}>{dialogo.mensaje}</p>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm debe usarse dentro de <ConfirmProvider>');
  return ctx;
}
