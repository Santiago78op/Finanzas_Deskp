import { createContext, useCallback, useContext, useEffect, useState } from 'react';

// Tema claro/oscuro por atributo data-theme en <html> + localStorage('tema').
// El script inline en index.html ya lo aplica antes del primer paint (evita
// el destello). El estado vive en un solo Context (ThemeProvider, montado
// una vez en main.jsx) — SideNav (que dispara toggle()) y DashboardView (que
// lee tema para las gráficas) comparten la MISMA instancia de estado, así
// que el ThemeProvider de MUI se entera del cambio y repinta fondo/cards/
// texto. Antes cada uno llamaba su propio useState() vía este hook y solo
// coincidían en la lectura inicial de data-theme, nunca en los cambios
// posteriores — el toggle "andaba" para el ticker (CSS puro) pero no para
// nada gobernado por MUI.
const ThemeContext = createContext(null);

export function TemaProvider({ children }) {
  const [tema, setTema] = useState(() => document.documentElement.dataset.theme || 'light');

  useEffect(() => {
    document.documentElement.dataset.theme = tema;
    localStorage.setItem('tema', tema);
  }, [tema]);

  const toggle = useCallback(() => {
    setTema(t => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  return (
    <ThemeContext.Provider value={{ tema, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme debe usarse dentro de <ThemeProvider>');
  return ctx;
}
