import { createContext, useCallback, useContext, useState } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null); // { msg, esError }

  const mostrarToast = useCallback((msg, esError = false) => {
    setToast({ msg, esError });
  }, []);

  const cerrar = () => setToast(null);

  return (
    <ToastContext.Provider value={mostrarToast}>
      {children}
      <Snackbar
        open={!!toast}
        autoHideDuration={2500}
        onClose={cerrar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {toast && (
          <Alert onClose={cerrar} severity={toast.esError ? 'error' : 'success'} variant="filled" sx={{ width: '100%' }}>
            {toast.msg}
          </Alert>
        )}
      </Snackbar>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return ctx;
}
