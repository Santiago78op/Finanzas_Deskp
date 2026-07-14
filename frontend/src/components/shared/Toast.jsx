import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null); // { msg, esError }
  const timerRef = useRef(null);

  const mostrarToast = useCallback((msg, esError = false) => {
    clearTimeout(timerRef.current);
    setToast({ msg, esError });
    timerRef.current = setTimeout(() => setToast(null), 2500);
  }, []);

  return (
    <ToastContext.Provider value={mostrarToast}>
      {children}
      {toast && (
        <div className={'toast' + (toast.esError ? ' error' : '')}>{toast.msg}</div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return ctx;
}
